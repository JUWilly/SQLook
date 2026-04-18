# SQLook

**Turn any SQL `SELECT` query into an interactive plain-English flowchart.**

SQLook parses your query and renders a live diagram showing exactly what data is being pulled and why — useful for reviewing queries, onboarding teammates, or documenting reports.

**[Try it live →](https://juwilly.github.io/SQLook/)**

---

## What it does

Paste a SQL query and the diagram updates instantly, breaking the query down into connected nodes:

| Node | What it represents |
|---|---|
| Table | Source tables from `FROM` and `JOIN` clauses, with the columns selected from each |
| Join | Join type and condition in plain English |
| Filter | `WHERE` and `HAVING` conditions |
| Group | `GROUP BY` columns |
| Window | Window functions (`ROW_NUMBER`, `RANK`, `LAG`, etc.) |
| Order / Limit | `ORDER BY` and `LIMIT` |
| Output | Final selected columns with aliases |

CTEs (`WITH` clauses) are shown as their own nodes and referenced by the tables that use them.

## SQL support

- Standard SQL, MySQL, and PostgreSQL syntax
- `WITH` / CTEs
- All join types (`INNER`, `LEFT`, `RIGHT`, `FULL OUTER`, `CROSS`)
- Window functions (`OVER (PARTITION BY ... ORDER BY ...)`)
- Snowflake `QUALIFY` clause
- 3-part table names (`catalog.schema.table`)

Not supported: `INSERT`, `UPDATE`, `DELETE`, DDL statements.

## Running locally

```bash
npm install
npm run dev
```

## Tech stack

- [React](https://react.dev) + [Vite](https://vitejs.dev)
- [React Flow](https://reactflow.dev) — interactive node canvas
- [node-sql-parser](https://github.com/taozhi8833998/node-sql-parser) — SQL → AST
