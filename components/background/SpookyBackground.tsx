import { SpookyEyes } from './SpookyEyes'

interface FogEffectProps {
  className: string
}

function FogEffect({ className }: FogEffectProps) {
  return (
    <div
      className={`absolute w-96 h-96 bg-purple-600/5 rounded-full blur-3xl ${className}`}
    />
  )
}

interface FloatingOrbProps {
  animation: 'float-slow' | 'float-medium' | 'sparkle'
  className: string
  blur?: boolean
}

function FloatingOrb({ animation, className, blur }: FloatingOrbProps) {
  return (
    <div
      className={`
      animate-${animation}
      absolute
      ${className}
      rounded-full
      ${blur ? 'blur-sm' : ''}
    `}
    />
  )
}

export function SpookyBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Fog/Mist Effects */}
      <FogEffect className="animate-fog-slow -top-20 -left-20" />
      <FogEffect className="animate-fog-reverse -bottom-20 -right-20" />

      {/* Floating Orbs */}
      <FloatingOrb
        animation="float-slow"
        className="top-20 left-[20%] w-4 h-4 bg-purple-400/20"
        blur
      />
      <FloatingOrb
        animation="float-medium"
        className="top-40 right-[30%] w-3 h-3 bg-purple-300/20"
        blur
      />
      <FloatingOrb
        animation="sparkle"
        className="top-60 left-[40%] w-2 h-2 bg-white/40"
      />

      <SpookyEyes position="top-[30%] right-[15%]" />
      <SpookyEyes position="top-[60%] left-[10%]" delay="delay-500" />
    </div>
  )
}
