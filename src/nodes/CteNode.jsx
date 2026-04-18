import { Handle, Position } from '@xyflow/react';

export default function CteNode({ data }) {
  return (
    <div className="sql-node cte-node">
      <div className="node-icon">⬡</div>
      <div className="node-title">{data.name}</div>
      <div className="node-sub">Common Table Expression</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
