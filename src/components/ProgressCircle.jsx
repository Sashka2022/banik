export default function ProgressCircle({ progress, isCompleted }) {
  const displayProgress = isCompleted ? 100 : (progress || 0);
  const circumference = 2 * Math.PI * 16;
  const offset = circumference * (1 - displayProgress / 100);

  return (
    <div className="relative w-11 h-11 flex-shrink-0">
      <svg className="w-11 h-11 transform -rotate-90">
        <circle
          cx="22"
          cy="22"
          r="16"
          stroke="currentColor"
          strokeWidth="3"
          fill="transparent"
          className="text-border"
        />
        <circle
          cx="22"
          cy="22"
          r="16"
          stroke="currentColor"
          strokeWidth="3"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${isCompleted ? "text-green-500" : "text-primary"} transition-all duration-500`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-muted-foreground">
        {displayProgress}%
      </div>
    </div>
  );
}