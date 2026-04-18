import { Parser } from 'node-sql-parser';

const parser = new Parser();

// ── SQL preprocessor ─────────────────────────────────────────────────────────

function parenClose(str, openIdx) {
  let d = 1;
  for (let i = openIdx + 1; i < str.length; i++) {
    if (str[i] === '(') d++;
    else if (str[i] === ')') { if (--d === 0) return i; }
  }
  return str.length - 1;
}

function stripComments(sql) {
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function stripQualify(sql) {
  const qm = /\bQUALIFY\b/i.exec(sql);
  if (!qm) return { sql, qualifyExpr: null };

  const after = sql.slice(qm.index + qm[0].length);
  let depth = 0, i = 0, end = after.length;

  while (i < after.length) {
    const ch = after[i];
    if (ch === '(') { depth++; i++; continue; }
    if (ch === ')') { depth--; i++; continue; }
    if (depth === 0 && /^\s*(LIMIT|ORDER\s+BY|GROUP\s+BY|HAVING|UNION|INTERSECT|EXCEPT)\b/i.test(after.slice(i))) {
      end = i; break;
    }
    i++;
  }

  const qualifyExpr = after.slice(0, end).trim();
  return { sql: (sql.slice(0, qm.index) + after.slice(end)).trim(), qualifyExpr };
}

// Matches known window functions with simple args (ROW_NUMBER(), RANK(), etc.) followed by OVER (
const WINDOW_RE = /\b(ROW_NUMBER|RANK|DENSE_RANK|NTILE|LAG|LEAD|FIRST_VALUE|LAST_VALUE|NTH_VALUE|CUME_DIST|PERCENT_RANK)\s*\([^()]*\)\s+OVER\s*\(/gi;

function replaceWindowCols(sql) {
  const funcs = [];
  let result = sql;
  let safety = 0;

  while (safety++ < 30) {
    WINDOW_RE.lastIndex = 0;
    const m = WINDOW_RE.exec(result);
    if (!m) break;

    // Find the balanced close of OVER (
    const overOpenIdx = m.index + m[0].length - 1; // position of '('
    const overCloseIdx = parenClose(result, overOpenIdx);

    // Check for optional AS alias after OVER (...)
    let endIdx = overCloseIdx + 1;
    const asMatch = result.slice(endIdx).match(/^(\s+AS\s+(\w+))/i);
    const alias = asMatch ? asMatch[2] : null;
    if (asMatch) endIdx += asMatch[1].length;

    funcs.push({ name: m[1], alias });

    const replacement = alias ? `NULL AS ${alias}` : 'NULL';
    result = result.slice(0, m.index) + replacement + result.slice(endIdx);
  }

  return { sql: result, funcs };
}

// Reduce catalog.schema.table → schema.table (parser handles two-part names fine)
function normalizeTableNames(sql) {
  return sql.replace(/\b(\w+)\.(\w+)\.(\w+)\b/g, '$2.$3');
}

function preprocessSQL(sql) {
  let s = stripComments(sql).trim();
  s = normalizeTableNames(s);
  const { sql: noQualify, qualifyExpr } = stripQualify(s);
  const { sql: noWindow, funcs: windowFuncs } = replaceWindowCols(noQualify);
  const wasPreprocessed = !!qualifyExpr || windowFuncs.length > 0;
  return { sql: noWindow.trim(), qualifyExpr, windowFuncs, wasPreprocessed };
}

function safeParseSQL(sql) {
  // Try parsing as-is first (MySQL then PostgreSQL), normalising multi-part names
  const normalized = normalizeTableNames(stripComments(sql).trim());
  for (const db of ['MySQL', 'PostgresQL']) {
    try {
      const ast = parser.astify(normalized, { database: db });
      return { ast: Array.isArray(ast) ? ast[0] : ast, error: null, preprocessed: null };
    } catch { /* try next */ }
  }
  // Fallback: preprocess to strip unsupported syntax and retry
  const prep = preprocessSQL(sql);
  for (const db of ['MySQL', 'PostgresQL']) {
    try {
      const ast = parser.astify(prep.sql, { database: db });
      return { ast: Array.isArray(ast) ? ast[0] : ast, error: null, preprocessed: prep };
    } catch { /* try next */ }
  }
  // Final attempt with comments stripped only
  try {
    const ast = parser.astify(stripComments(sql).trim(), { database: 'PostgresQL' });
    return { ast: Array.isArray(ast) ? ast[0] : ast, error: null, preprocessed: null };
  } catch (e) {
    return { ast: null, error: e.message, preprocessed: null };
  }
}

// ── Expression → human-readable string ──────────────────────────────────────

function exprToHuman(expr, depth = 0) {
  if (!expr) return '';

  switch (expr.type) {
    case 'binary_expr': {
      const opMap = {
        '=': 'equals', '!=': 'does not equal', '<>': 'does not equal',
        '>': 'is greater than', '<': 'is less than',
        '>=': 'is at least', '<=': 'is at most',
        'AND': 'AND', 'OR': 'OR',
        'LIKE': 'matches pattern', 'NOT LIKE': 'does not match pattern',
        'IN': 'is one of', 'NOT IN': 'is not one of',
        'IS': 'is', 'IS NOT': 'is not',
        '+': '+', '-': '−', '*': '×', '/': '÷',
      };
      const op = opMap[expr.operator?.toUpperCase()] ?? expr.operator;
      const left = exprToHuman(expr.left, depth + 1);
      const right = exprToHuman(expr.right, depth + 1);
      if ((expr.operator === 'AND' || expr.operator === 'OR') && depth > 0) {
        return `(${left} ${op} ${right})`;
      }
      return `${left} ${op} ${right}`;
    }
    case 'column_ref':
      return expr.table ? `${expr.table}.${expr.column}` : expr.column;
    case 'number':
      return String(expr.value);
    case 'string':
      return `"${expr.value}"`;
    case 'bool':
      return expr.value ? 'TRUE' : 'FALSE';
    case 'null':
      return 'NULL';
    case 'aggr_func':
      return aggrToHuman(expr);
    case 'function':
      return funcToHuman(expr);
    case 'expr_list':
      return (expr.value || []).map(v => exprToHuman(v)).join(', ');
    case 'unary_expr':
      return `NOT ${exprToHuman(expr.expr)}`;
    case 'interval':
      return `${expr.value} ${expr.unit}`;
    case 'cast':
      return `${exprToHuman(expr.expr)} as ${expr.target?.dataType}`;
    case 'case': {
      const whens = (expr.args?.when || []).map((w, i) =>
        `When ${exprToHuman(w)} → ${exprToHuman(expr.args.then[i])}`
      );
      const fallback = expr.args?.else ? `Otherwise → ${exprToHuman(expr.args.else)}` : '';
      return [expr.args?.condition ? `Case ${exprToHuman(expr.args.condition)}` : 'Case', ...whens, fallback].filter(Boolean).join('; ');
    }
    case 'select':
      return '(subquery)';
    default:
      return expr.value != null ? String(expr.value) : JSON.stringify(expr);
  }
}

function aggrToHuman(expr) {
  const nameMap = {
    COUNT: 'Count of', SUM: 'Total', AVG: 'Average', MIN: 'Minimum',
    MAX: 'Maximum', GROUP_CONCAT: 'Joined list of', STRING_AGG: 'Joined list of',
  };
  const name = expr.name?.toUpperCase();
  const label = nameMap[name] ?? name;
  if (name === 'COUNT' && expr.args?.expr?.type === 'star') return 'Count of rows';
  const inner = exprToHuman(expr.args?.expr);
  return `${label} ${inner}`;
}

function funcToHuman(expr) {
  const name = typeof expr.name === 'string' ? expr.name : expr.name?.name ?? 'fn';
  const args = (expr.args?.value || []).map(a => exprToHuman(a)).join(', ');
  return `${name}(${args})`;
}

function joinTypeToHuman(join) {
  const map = {
    'INNER JOIN': 'Rows that exist in both',
    'LEFT JOIN': 'All rows from left, plus matching from right',
    'LEFT OUTER JOIN': 'All rows from left, plus matching from right',
    'RIGHT JOIN': 'All rows from right, plus matching from left',
    'RIGHT OUTER JOIN': 'All rows from right, plus matching from left',
    'FULL JOIN': 'All rows from both sides',
    'FULL OUTER JOIN': 'All rows from both sides',
    'CROSS JOIN': 'Every combination of rows',
    'JOIN': 'Rows that exist in both',
  };
  return map[join?.toUpperCase()] ?? join ?? 'Join';
}

// ── Table reference extraction ────────────────────────────────────────────────

function extractTableName(tableRef) {
  if (!tableRef) return null;
  if (tableRef.type === 'subquery') return null;
  // node-sql-parser puts catalog/schema in tableRef.db; table name may contain dots for 3-part names
  let name = tableRef.table || tableRef.name || tableRef;
  if (typeof name === 'string' && name.includes('.')) {
    // e.g. "justin_w.gerald_enrich" → take last segment only
    name = name.split('.').pop();
  }
  const schema = tableRef.db ? `${tableRef.db}.` : '';
  return { name, schema, alias: tableRef.as || null };
}

function getDisplayName(ref) {
  if (!ref) return '?';
  return ref.alias ? `${ref.name} (${ref.alias})` : ref.name;
}

// ── CTE extraction ────────────────────────────────────────────────────────────

function cteName(raw) {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  return raw.value ?? raw.name ?? String(raw);
}

function extractCTEs(ast) {
  if (!ast.with) return [];
  return ast.with.map(cte => {
    const name = cteName(cte.name);
    return { id: `cte_${name}`, name, innerAst: Array.isArray(cte.stmt) ? cte.stmt[0] : cte.stmt };
  });
}

// ── Column → table attribution ───────────────────────────────────────────────

function firstTableRef(expr) {
  if (!expr) return null;
  switch (expr.type) {
    case 'column_ref': return expr.table || null;
    case 'aggr_func':  return firstTableRef(expr.args?.expr);
    case 'binary_expr': return firstTableRef(expr.left) || firstTableRef(expr.right);
    case 'function':
      for (const a of (expr.args?.value || [])) { const t = firstTableRef(a); if (t) return t; }
      return null;
    case 'case':
      for (const w of (expr.args?.when || [])) { const t = firstTableRef(w); if (t) return t; }
      return firstTableRef(expr.args?.then?.[0]) || firstTableRef(expr.args?.else);
    default: return null;
  }
}

function buildColumnsByTable(columns) {
  const map = {};
  if (!columns || columns === '*') return map;
  for (const col of columns) {
    const tableKey = firstTableRef(col.expr);
    if (!tableKey) continue;
    if (!map[tableKey]) map[tableKey] = [];
    map[tableKey].push({ label: exprToHuman(col.expr), alias: col.as || null });
  }
  return map;
}

// ── SELECT columns ────────────────────────────────────────────────────────────

function extractColumns(columns) {
  if (!columns || columns === '*') return [{ label: 'All columns (*)', alias: null }];
  return columns.map(col => {
    if (col.expr?.type === 'star' || col.expr?.column === '*') {
      const prefix = col.expr?.table ? `${col.expr.table}.` : '';
      return { label: `${prefix}All columns (*)`, alias: col.as };
    }
    const label = exprToHuman(col.expr);
    return { label, alias: col.as || null };
  });
}

// ── Main graph builder ────────────────────────────────────────────────────────

export function buildGraph(sql) {
  try {
    return _buildGraph(sql);
  } catch (e) {
    return { nodes: [], edges: [], error: `Visualization error: ${e.message}` };
  }
}

function _buildGraph(sql) {
  const { ast, error, preprocessed } = safeParseSQL(sql.trim());
  if (error || !ast) return { nodes: [], edges: [], error: error ?? 'Could not parse query' };
  if (ast.type !== 'select') return { nodes: [], edges: [], error: 'Only SELECT queries are supported' };
  const windowFuncs = preprocessed?.windowFuncs ?? [];
  const qualifyExpr = preprocessed?.qualifyExpr ?? null;

  const nodes = [];
  const edges = [];
  let y = 0;
  const X_CENTER = 0;
  const Y_STEP = 160;

  function addEdge(source, target, label = '') {
    edges.push({ id: `${source}->${target}`, source, target, label, type: 'smoothstep', animated: true });
  }

  // Build SELECT column→table map up front
  const columnsByTable = buildColumnsByTable(ast.columns);

  // CTEs
  const ctes = extractCTEs(ast);
  const cteIds = {};
  ctes.forEach((cte, i) => {
    const id = cte.id;
    cteIds[cte.name.toLowerCase()] = id;
    nodes.push({ id, type: 'cteNode', position: { x: X_CENTER + (i - ctes.length / 2) * 340, y }, data: { name: cte.name } });
  });
  if (ctes.length) y += Y_STEP;

  // FROM tables
  const fromList = Array.isArray(ast.from) ? ast.from : ast.from ? [ast.from] : [];
  const tableNodeIds = [];

  const mainFromItems = fromList.filter(t => !t.join);
  const joinItems = fromList.filter(t => t.join);

  const allSourceItems = [...mainFromItems];
  joinItems.forEach(j => allSourceItems.push(j));

  const tableSpacing = 320;
  const totalWidth = (allSourceItems.length - 1) * tableSpacing;
  const startX = X_CENTER - totalWidth / 2;

  allSourceItems.forEach((tableRef, i) => {
    const ref = extractTableName(tableRef);
    if (!ref) {
      // Subquery
      const id = `subq_${i}`;
      tableNodeIds.push({ id, alias: tableRef.as });
      nodes.push({ id, type: 'subqueryNode', position: { x: startX + i * tableSpacing, y }, data: { alias: tableRef.as || `subquery ${i + 1}` } });
    } else {
      const id = `table_${ref.name}_${i}`;
      tableNodeIds.push({ id, alias: ref.alias || ref.name, name: ref.name });
      const isCteRef = cteIds[ref.name.toLowerCase()];
      const lookupKey = ref.alias || ref.name;
      const selectedColumns = columnsByTable[lookupKey] || columnsByTable[ref.name] || [];
      nodes.push({
        id, type: 'tableNode',
        position: { x: startX + i * tableSpacing, y },
        data: { name: ref.name, alias: ref.alias, isCte: !!isCteRef, selectedColumns },
      });
      if (isCteRef) addEdge(isCteRef, id, 'uses CTE');
    }
  });

  // Join node (if multiple tables)
  let prevId;
  if (tableNodeIds.length === 1) {
    prevId = tableNodeIds[0].id;
    y += Y_STEP;
  } else {
    y += Y_STEP;
    const joinId = 'join_node';
    const joinLines = joinItems.map(j => {
      const ref = extractTableName(j);
      const typeLabel = joinTypeToHuman(j.join);
      const onClause = j.on ? exprToHuman(j.on) : j.using ? `Using ${Array.isArray(j.using) ? j.using.map(u => u.column || u).join(', ') : j.using}` : '';
      return { type: typeLabel, table: ref ? getDisplayName(ref) : (j.as || 'subquery'), on: onClause };
    });

    nodes.push({ id: joinId, type: 'joinNode', position: { x: X_CENTER, y }, data: { joins: joinLines } });
    tableNodeIds.forEach(t => addEdge(t.id, joinId));
    prevId = joinId;
    y += Y_STEP;
  }

  // WHERE
  if (ast.where) {
    const whereId = 'where_node';
    nodes.push({ id: whereId, type: 'filterNode', position: { x: X_CENTER, y }, data: { label: 'Filter rows (WHERE)', conditions: [exprToHuman(ast.where)] } });
    addEdge(prevId, whereId);
    prevId = whereId;
    y += Y_STEP;
  }

  // GROUP BY
  if (ast.groupby) {
    const groupId = 'group_node';
    const cols = ast.groupby.columns || ast.groupby;
    const groupCols = Array.isArray(cols) ? cols.map(c => exprToHuman(c)) : [exprToHuman(cols)];
    nodes.push({ id: groupId, type: 'groupNode', position: { x: X_CENTER, y }, data: { columns: groupCols } });
    addEdge(prevId, groupId);
    prevId = groupId;
    y += Y_STEP;
  }

  // HAVING
  if (ast.having) {
    const havingId = 'having_node';
    nodes.push({ id: havingId, type: 'filterNode', position: { x: X_CENTER, y }, data: { label: 'Filter groups (HAVING)', conditions: [exprToHuman(ast.having)] } });
    addEdge(prevId, havingId);
    prevId = havingId;
    y += Y_STEP;
  }

  // QUALIFY (Snowflake-specific row filter after window computation)
  if (qualifyExpr) {
    const qualifyId = 'qualify_node';
    nodes.push({ id: qualifyId, type: 'filterNode', position: { x: X_CENTER, y }, data: { label: 'Filter rows (QUALIFY)', conditions: [qualifyExpr] } });
    addEdge(prevId, qualifyId);
    prevId = qualifyId;
    y += Y_STEP;
  }

  // Window functions (stripped from SELECT for parsing; shown here)
  if (windowFuncs.length > 0) {
    const windowId = 'window_node';
    nodes.push({ id: windowId, type: 'windowNode', position: { x: X_CENTER, y }, data: { funcs: windowFuncs } });
    addEdge(prevId, windowId);
    prevId = windowId;
    y += Y_STEP;
  }

  // ORDER BY
  if (ast.orderby) {
    const orderId = 'order_node';
    const cols = ast.orderby.map(o => `${exprToHuman(o.expr)} ${(o.type || 'ASC').toUpperCase()}`);
    nodes.push({ id: orderId, type: 'orderNode', position: { x: X_CENTER, y }, data: { columns: cols } });
    addEdge(prevId, orderId);
    prevId = orderId;
    y += Y_STEP;
  }

  // LIMIT
  if (ast.limit) {
    const limitId = 'limit_node';
    const val = ast.limit?.value?.[0]?.value ?? ast.limit?.value ?? ast.limit;
    const offset = ast.limit?.value?.[1]?.value;
    nodes.push({ id: limitId, type: 'limitNode', position: { x: X_CENTER, y }, data: { limit: val, offset } });
    addEdge(prevId, limitId);
    prevId = limitId;
    y += Y_STEP;
  }

  // SELECT output
  const outputId = 'output_node';
  const columns = extractColumns(ast.columns);
  const isDistinct = !!ast.distinct;
  nodes.push({ id: outputId, type: 'outputNode', position: { x: X_CENTER, y }, data: { columns, distinct: isDistinct } });
  addEdge(prevId, outputId);

  return { nodes, edges, error: null };
}
