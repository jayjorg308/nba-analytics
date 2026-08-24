// The one side-name rule for every comparison surface (the scoreboard's
// chips, the free-throw tables — ADR-0078/0079), in its own module so
// component files keep component-only exports.

/** Chip-length side names: the label's last word ("Donovan Mitchell" ->
 * "Mitchell", "Before" stays "Before"), falling back to the full labels if
 * the short forms collide. */
export function shortLabels(metrics: {
  left: { label: string }
  right: { label: string }
}): { left: string; right: string } {
  const last = (label: string) => label.split(' ').at(-1) ?? label
  const left = last(metrics.left.label)
  const right = last(metrics.right.label)
  return left === right
    ? { left: metrics.left.label, right: metrics.right.label }
    : { left, right }
}
