import { Handle, Position } from '@xyflow/react';

export default function OrderNode({ data }) {
  return (
    <div className="sql-node order-node">
      <Handle type="target" position={Position.Top} />
      <div className="node-icon">↕</div>
      <div className="node-title">Sort Results</div>
      <div className="col-list">
        {data.columns.map((c, i) => <div key={i} className="col-item">{c}</div>)}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
