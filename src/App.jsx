import { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';

import { buildGraph } from './sqlParser';
import TableNode from './nodes/TableNode';
import SubqueryNode from './nodes/SubqueryNode';
import CteNode from './nodes/CteNode';
import JoinNode from './nodes/JoinNode';
import FilterNode from './nodes/FilterNode';
import GroupNode from './nodes/GroupNode';
import OrderNode from './nodes/OrderNode';
import LimitNode from './nodes/LimitNode';
import OutputNode from './nodes/OutputNode';
import WindowNode from './nodes/WindowNode';

const nodeTypes = {
  tableNode: TableNode,
  subqueryNode: SubqueryNode,
  cteNode: CteNode,
  joinNode: JoinNode,
  filterNode: FilterNode,
  groupNode: GroupNode,
  orderNode: OrderNode,
  limitNode: LimitNode,
  outputNode: OutputNode,
  windowNode: WindowNode,
};

const EXAMPLE_SQL = `SELECT
  c.customer_name,
  COUNT(o.order_id)  AS total_orders,
  SUM(o.amount)      AS revenue
FROM customers AS c
  INNER JOIN orders AS o ON o.customer_id = c.id
WHERE c.country = 'US'
  AND o.status != 'cancelled'
GROUP BY c.customer_name
HAVING SUM(o.amount) > 1000
ORDER BY revenue DESC
LIMIT 10`;

export default function App() {
  const [sql, setSql] = useState(EXAMPLE_SQL);
  const [error, setError] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const parseAndRender = useCallback((query) => {
    const { nodes: n, edges: e, error: err } = buildGraph(query);
    setError(err);
    setNodes(n);
    setEdges(e);
  }, [setNodes, setEdges]);

  useEffect(() => {
    parseAndRender(sql);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(e) {
    const val = e.target.value;
    setSql(val);
    parseAndRender(val);
  }

  const [tab, setTab] = useState('query');

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-icon">◈</span>
          <span className="brand-name">SQL<span className="brand-accent">ook</span></span>
        </div>
        <p className="header-tagline">Paste a SQL query — see what it does at a glance</p>
      </header>

      <div className="app-body">
        <div className="input-panel">
          {tab === 'query' ? (
            <>
              <div className="panel-label">SQL Query</div>
              <textarea
                className="sql-input"
                value={sql}
                onChange={handleChange}
                spellCheck={false}
                placeholder="Paste your SQL query here…"
              />
              {error && (
                <div className="parse-error">
                  <span className="error-icon">⚠</span> {error}
                </div>
              )}
              <div className="input-hint">
                Edit the query above — the diagram updates automatically.
              </div>
            </>
          ) : (
            <div className="about-panel">
              <section className="about-section">
                <h3>What is SQLook?</h3>
                <p>SQLook turns a SQL <code>SELECT</code> query into a plain-English flowchart so anyone — even without SQL knowledge — can see exactly what data is being pulled and why.</p>
              </section>

              <section className="about-section">
                <h3>How to use it</h3>
                <ol>
                  <li>Paste a <code>SELECT</code> query into the Query tab.</li>
                  <li>The diagram updates automatically as you type.</li>
                  <li>Drag, zoom, and pan the diagram to explore it.</li>
                </ol>
              </section>

              <section className="about-section">
                <h3>What the diagram shows</h3>
                <ul>
                  <li className="legend-item"><span className="legend-dot blue" />Source tables (FROM / JOINs)</li>
                  <li className="legend-item"><span className="legend-dot cyan" />Common Table Expressions (CTEs / WITH)</li>
                  <li className="legend-item"><span className="legend-dot indigo" />Join logic — in plain English</li>
                  <li className="legend-item"><span className="legend-dot amber" />Row filters (WHERE / HAVING)</li>
                  <li className="legend-item"><span className="legend-dot purple" />Grouping (GROUP BY)</li>
                  <li className="legend-item"><span className="legend-dot gray" />Sorting &amp; row limits</li>
                  <li className="legend-item"><span className="legend-dot green" />Final output columns</li>
                </ul>
              </section>

              <section className="about-section">
                <h3>Known limitations</h3>
                <ul>
                  <li><strong>Window functions</strong> — <code>RANK() OVER</code>, <code>ROW_NUMBER() OVER</code>, etc. are not supported and will produce a parse error.</li>
                  <li><strong>Non-SELECT statements</strong> — <code>INSERT</code>, <code>UPDATE</code>, <code>DELETE</code>, and DDL are not visualized.</li>
                  <li><strong>Nested subqueries</strong> in <code>SELECT</code> or <code>WHERE</code> clauses are shown as a single "Subquery" placeholder rather than expanded inline.</li>
                  <li><strong>Dialect quirks</strong> — most standard SQL, MySQL, and PostgreSQL syntax is supported. Highly vendor-specific syntax may not parse correctly.</li>
                </ul>
              </section>
            </div>
          )}

          <div className="panel-tabs">
            <button className={`panel-tab${tab === 'query' ? ' active' : ''}`} onClick={() => setTab('query')}>Query</button>
            <button className={`panel-tab${tab === 'about' ? ' active' : ''}`} onClick={() => setTab('about')}>About</button>
          </div>
        </div>

        <div className="flow-panel">
          {nodes.length === 0 && !error ? (
            <div className="empty-state">Start typing a SELECT query to see the visualization.</div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              minZoom={0.2}
              defaultEdgeOptions={{
                style: { stroke: '#94a3b8', strokeWidth: 2 },
                labelStyle: { fill: '#64748b', fontSize: 11 },
                labelBgStyle: { fill: '#f8fafc' },
              }}
            >
              <Background color="#e2e8f0" gap={24} />
              <Controls />
              <MiniMap nodeColor={nodeColor} maskColor="rgba(248,250,252,0.7)" />
            </ReactFlow>
          )}
        </div>
      </div>
    </div>
  );
}

function nodeColor(node) {
  const map = {
    tableNode: '#3b82f6',
    subqueryNode: '#8b5cf6',
    cteNode: '#06b6d4',
    joinNode: '#6366f1',
    filterNode: '#f59e0b',
    groupNode: '#8b5cf6',
    orderNode: '#64748b',
    limitNode: '#64748b',
    outputNode: '#10b981',
    windowNode: '#7c3aed',
  };
  return map[node.type] ?? '#94a3b8';
}
