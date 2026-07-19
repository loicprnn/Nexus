import { useMemo } from 'react'
import { Particles, ParticlesProvider } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'

// Engine init — must be a STABLE reference across the app lifecycle
// (@tsparticles/react v4 throws if the init callback identity changes), so it
// lives at module scope rather than inside the component.
const initEngine = async (engine) => {
  await loadSlim(engine)
}

// Ambient particle field rendered once, behind the whole app. Deliberately very
// subtle and slow — a faint constellation drifting on the #0A0A0A background,
// never competing with the data. Non-interactive (pointer-events disabled by the
// host layer) so it can't intercept clicks. Honors prefers-reduced-motion by not
// rendering at all. ParticlesProvider only renders its child once the engine has
// loaded, so it gates just this subtree (not the app).
export default function ParticleBackground() {
  // Disabled on the light theme — white particles would be invisible on the
  // #F5F5F0 background and the clean fintech look reads better without them.
  return null

  // eslint-disable-next-line no-unreachable
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const options = useMemo(
    () => ({
      fullScreen: { enable: false },
      fpsLimit: 60,
      detectRetina: true,
      background: { color: 'transparent' },
      particles: {
        number: { value: 50, density: { enable: true, width: 1400, height: 900 } },
        // Pure white, max 3% opacity, 1px — a barely-there dust that never
        // competes with the data.
        color: { value: '#FFFFFF' },
        opacity: {
          value: { min: 0.01, max: 0.03 },
          animation: { enable: true, speed: 0.2, sync: false },
        },
        size: { value: 0.8 },
        links: { enable: false },
        move: {
          enable: true,
          speed: 0.18,
          direction: 'none',
          random: true,
          straight: false,
          outModes: { default: 'out' },
        },
      },
      interactivity: {
        events: {
          onHover: { enable: false },
          onClick: { enable: false },
          resize: { enable: true },
        },
      },
    }),
    [],
  )

  if (reduceMotion) return null

  return (
    <ParticlesProvider init={initEngine}>
      <Particles id="nexus-particles" options={options} className="h-full w-full" />
    </ParticlesProvider>
  )
}
