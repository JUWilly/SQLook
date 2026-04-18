import { Handle, Position } from '@xyflow/react';

export default function OutputNode({ data }) {
  return (
    <div className="sql-node output-node">
      <Handle type="target" position={Position.Top} />
      <div className="node-icon">✦</div>
      <div className="node-title">Final Output</div>
      {data.distinct && <div className="node-badge distinct">Distinct rows only</div>}
      <div className="col-list">
        {data.columns.map((c, i) => (
          <div key={i} className="col-item output-col">
            <span className="col-label">{c.label}</span>
            {c.alias && <span className="col-alias">→ {c.alias}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
