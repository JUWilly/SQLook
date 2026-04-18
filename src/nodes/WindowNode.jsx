import { Handle, Position } from '@xyflow/react';

const FUNC_LABELS = {
  ROW_NUMBER: 'Row number within partition',
  RANK: 'Rank within partition',
  DENSE_RANK: 'Dense rank (no gaps)',
  NTILE: 'Bucket number',
  LAG: 'Value from previous row',
  LEAD: 'Value from next row',
  FIRST_VALUE: 'First value in window',
  LAST_VALUE: 'Last value in window',
  NTH_VALUE: 'Nth value in window',
  CUME_DIST: 'Cumulative distribution',
  PERCENT_RANK: 'Relative rank (0–1)',
};

export default function WindowNode({ data }) {
  return (
    <div className="sql-node window-node">
      <Handle type="target" position={Position.Top} />
      <div className="node-icon">⊡</div>
      <div className="node-title">Computed Window Columns</div>
      <div className="node-sub">Calculated across a sliding window of rows</div>
      <div className="col-list" style={{ marginTop: 6 }}>
        {data.funcs.map((f, i) => (
          <div key={i} className="col-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#6d28d9', fontSize: 11 }}>{FUNC_LABELS[f.name.toUpperCase()] ?? f.name}</span>
            {f.alias && <span className="col-alias">→ {f.alias}</span>}
          </div>
        ))}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
