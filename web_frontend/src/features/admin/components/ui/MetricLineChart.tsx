import { useId } from 'react'

export type MetricLinePoint = {
  label: string
  value: number
}

type MetricLineChartProps = {
  points: MetricLinePoint[]
  ariaLabel: string
  formatValue?: (value: number) => string
  emptyLabel?: string
}

const WIDTH = 760
const HEIGHT = 268
const PAD_X = 42
const PAD_TOP = 18
const PAD_BOTTOM = 38

const getNiceMaximum = (value: number) => {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * magnitude
}

export function MetricLineChart({
  points,
  ariaLabel,
  formatValue = (value) => new Intl.NumberFormat('vi-VN').format(value),
  emptyLabel = 'Chưa có dữ liệu trong kỳ này.',
}: MetricLineChartProps) {
  const gradientId = `admin-line-gradient-${useId().replace(/:/g, '')}`
  const maxValue = getNiceMaximum(Math.max(...points.map((point) => point.value), 0))
  const plotWidth = WIDTH - PAD_X * 2
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM
  const xAt = (index: number) => PAD_X + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth)
  const yAt = (value: number) => PAD_TOP + plotHeight - (value / maxValue) * plotHeight
  const linePath = points.map((point, index) => (
    `${index === 0 ? 'M' : 'L'} ${xAt(index).toFixed(2)} ${yAt(point.value).toFixed(2)}`
  )).join(' ')
  const areaPath = points.length
    ? `${linePath} L ${xAt(points.length - 1).toFixed(2)} ${(PAD_TOP + plotHeight).toFixed(2)} L ${xAt(0).toFixed(2)} ${(PAD_TOP + plotHeight).toFixed(2)} Z`
    : ''
  const labelEvery = Math.max(1, Math.ceil(points.length / 6))

  if (!points.length) {
    return <div className="admin-ui-line-chart-empty">{emptyLabel}</div>
  }

  return (
    <div className="admin-ui-line-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={ariaLabel} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--admin-chart-color, #2563eb)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--admin-chart-color, #2563eb)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = PAD_TOP + plotHeight * ratio
          const value = maxValue * (1 - ratio)
          return (
            <g key={ratio}>
              <line className="admin-ui-line-chart__grid" x1={PAD_X} y1={y} x2={WIDTH - PAD_X} y2={y} />
              <text className="admin-ui-line-chart__y-label" x={PAD_X - 9} y={y + 4}>{formatValue(value)}</text>
            </g>
          )
        })}

        <path className="admin-ui-line-chart__area" d={areaPath} fill={`url(#${gradientId})`} />
        <path className="admin-ui-line-chart__line" d={linePath} />

        {points.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle
              className="admin-ui-line-chart__hit"
              cx={xAt(index)}
              cy={yAt(point.value)}
              r="10"
            >
              <title>{`${point.label}: ${formatValue(point.value)}`}</title>
            </circle>
            {point.value > 0 ? (
              <circle
                className="admin-ui-line-chart__dot"
                cx={xAt(index)}
                cy={yAt(point.value)}
                r={index === points.length - 1 ? 4.5 : 2.5}
              />
            ) : null}
            {(index % labelEvery === 0 || index === points.length - 1) ? (
              <text className="admin-ui-line-chart__x-label" x={xAt(index)} y={HEIGHT - 11}>{point.label}</text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  )
}

