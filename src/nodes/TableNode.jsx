import { Handle, Position } from '@xyflow/react';

export default function TableNode({ data }) {
  return (
    <div className={`sql-node table-node${data.isCte ? ' cte-ref' : ''}`}>
      <div className="node-icon">⊞</div>
      <div className="node-label">Table:</div>
      <div className="node-title">{data.name}</div>
      {data.alias && <div className="node-sub">alias: {data.alias}</div>}
      {data.isCte && <div className="node-badge">CTE</div>}

      {data.selectedColumns?.length > 0 && (
        <div className="table-cols">
          <div className="table-cols-label">Columns selected</div>
          {data.selectedColumns.map((c, i) => (
            <div key={i} className="table-col-item">
              <span className="col-label">{c.label}</span>
              {c.alias && <span className="col-alias">→ {c.alias}</span>}
            </div>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
