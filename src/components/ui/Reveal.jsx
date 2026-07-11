import { motion, useReducedMotion } from 'framer-motion'

// Entrance animation primitives — a subtle fade + upward translation, designed
// to stay out of the way of the data. `RevealStagger` is the container; each
// direct child rendered through `Reveal` (or `RevealStagger`'s auto-wrap) eases
// in one after another. Honors prefers-reduced-motion (no transform/opacity
// shift when the user asks for less motion).

const EASE = [0.22, 0.61, 0.36, 1] // gentle ease-out

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
}

// A single revealed element (fade + rise). Use inside a RevealStagger, or
// standalone (it animates on mount via initial/animate).
export function Reveal({ as = 'div', className, children, ...rest }) {
  const reduce = useReducedMotion()
  const MotionTag = motion[as] ?? motion.div
  return (
    <MotionTag
      className={className}
      variants={reduce ? undefined : itemVariants}
      initial={reduce ? false : 'hidden'}
      animate="show"
      {...rest}
    >
      {children}
    </MotionTag>
  )
}

// Container that staggers its children. By default every direct child is wrapped
// in a Reveal item so callers don't have to touch each card. Pass
// `wrap={false}` to opt out and place Reveal items manually.
export function RevealStagger({ as = 'div', className, wrap = true, children, ...rest }) {
  const reduce = useReducedMotion()
  const MotionTag = motion[as] ?? motion.div

  if (reduce) {
    const Tag = as
    return (
      <Tag className={className} {...rest}>
        {children}
      </Tag>
    )
  }

  return (
    <MotionTag
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="show"
      {...rest}
    >
      {wrap
        ? // Wrap each top-level child as a reveal item. Nullish children are
          // skipped so conditional sections don't create empty wrappers.
          // eslint-disable-next-line react/no-array-index-key
          [].concat(children).map((child, i) =>
            child == null || child === false ? (
              child
            ) : (
              <motion.div key={i} variants={itemVariants}>
                {child}
              </motion.div>
            ),
          )
        : children}
    </MotionTag>
  )
}

export { itemVariants, containerVariants }
