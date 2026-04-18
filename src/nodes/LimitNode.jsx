import { Handle, Position } from '@xyflow/react';

export default function LimitNode({ data }) {
  return (
    <div className="sql-node limit-node">
      <Handle type="target" position={Position.Top} />
      <div className="node-icon">⊤</div>
      <div className="node-title">Limit Results</div>
      <div className="node-sub">Take only the first {data.limit} rows{data.offset ? `, starting at row ${data.offset}` : ''}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
