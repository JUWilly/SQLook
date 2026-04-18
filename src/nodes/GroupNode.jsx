import { Handle, Position } from '@xyflow/react';

export default function GroupNode({ data }) {
  return (
    <div className="sql-node group-node">
      <Handle type="target" position={Position.Top} />
      <div className="node-icon">⊞</div>
      <div className="node-title">Group Rows</div>
      <div className="node-sub">Group by equal values of:</div>
      <div className="col-list">
        {data.columns.map((c, i) => <div key={i} className="col-item">{c}</div>)}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
