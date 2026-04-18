import { Handle, Position } from '@xyflow/react';

export default function FilterNode({ data }) {
  return (
    <div className="sql-node filter-node">
      <Handle type="target" position={Position.Top} />
      <div className="node-icon">▽</div>
      <div className="node-title">{data.label}</div>
      <div className="condition-list">
        {data.conditions.map((c, i) => (
          <div key={i} className="condition-item">{c}</div>
        ))}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
