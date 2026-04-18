import { Handle, Position } from '@xyflow/react';

export default function JoinNode({ data }) {
  return (
    <div className="sql-node join-node">
      <Handle type="target" position={Position.Top} />
      <div className="node-icon">⋈</div>
      <div className="node-title">Combine Tables</div>
      <div className="join-list">
        {data.joins.map((j, i) => (
          <div key={i} className="join-item">
            <span className="join-type">{j.type}</span>
            <span className="join-table">{j.table}</span>
            {j.on && <span className="join-on">where {j.on}</span>}
          </div>
        ))}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
