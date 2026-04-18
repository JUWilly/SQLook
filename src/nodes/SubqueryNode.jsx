import { Handle, Position } from '@xyflow/react';

export default function SubqueryNode({ data }) {
  return (
    <div className="sql-node subquery-node">
      <div className="node-icon">⊂</div>
      <div className="node-title">Subquery</div>
      {data.alias && <div className="node-sub">alias: {data.alias}</div>}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
