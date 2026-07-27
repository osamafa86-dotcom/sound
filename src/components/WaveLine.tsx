/** الخط الموجي القرمزي — التوقيع البصري لهوية «ورق وقرمزي» */
export default function WaveLine({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 220 20"
      fill="none"
      className={`h-4 w-40 text-primary ${className}`}
    >
      <path
        d="M2 10 C 12 -6, 20 -6, 30 10 S 48 26, 58 10 S 76 -6, 86 10 S 104 26, 114 10 S 132 -6, 142 10 S 160 26, 170 10 S 188 -6, 198 10 S 210 18, 218 10"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
