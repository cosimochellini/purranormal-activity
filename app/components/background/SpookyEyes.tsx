interface SpookyEyesProps {
  position: string;
  delay?: string;
}

const EyeOrb = () => (
  <div className="w-2 h-3 bg-purple-300 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)] relative animate-eye-shine">
    <div className="absolute inset-0 mx-auto w-[2px] h-full bg-purple-900 rounded-full animate-pupil" />
  </div>
);

export const SpookyEyes = ({ position, delay = '' }: SpookyEyesProps) => (
  <div className={`absolute ${position} ${delay} flex gap-3`}>
    <EyeOrb />
    <EyeOrb />
  </div>
);
