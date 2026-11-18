export function Arrow() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 12h15m-6-6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Midmap-style folded geometric ribbon mark */
export function BookMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5.5 23V9.5c0-1.1 1.3-1.7 2.1-.9L16 17l8.4-8.4c.8-.8 2.1-.2 2.1.9V23"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 23 11 17.5M26.5 23 21 17.5"
        stroke="#10b981"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NavGlyph({ kind }: { kind: string }) {
  switch (kind) {
    case "/":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m4 10.5 8-6.5 8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "/study":
    case "/courses":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="3.5"
            y="8.5"
            width="6"
            height="7"
            rx="1.6"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <rect
            x="14.5"
            y="4"
            width="6"
            height="6"
            rx="1.6"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <rect
            x="14.5"
            y="14"
            width="6"
            height="6"
            rx="1.6"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M9.5 12h2.5V7h2.5M12 12v5h2.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      );
    case "/practice":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="8.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="m8.8 12.2 2.2 2.2 4.4-4.6"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "/photo-question":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 8.5A2 2 0 0 1 6 6.5h2l1.4-2h5.2l1.4 2h2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle
            cx="12"
            cy="13"
            r="3"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "/ai-teacher":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 3.5 13.8 8l4.7 1.8-4.7 1.8L12 16.3l-1.8-4.7L5.5 9.8 10.2 8 12 3.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="4.5"
            y="4.5"
            width="6.2"
            height="6.2"
            rx="1.4"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <rect
            x="13.3"
            y="4.5"
            width="6.2"
            height="6.2"
            rx="1.4"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <rect
            x="4.5"
            y="13.3"
            width="6.2"
            height="6.2"
            rx="1.4"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <rect
            x="13.3"
            y="13.3"
            width="6.2"
            height="6.2"
            rx="1.4"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      );
  }
}
