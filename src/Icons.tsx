import type { ViewId } from './poem';

type IconName = ViewId | 'pause' | 'play' | 'arrow' | 'motion' | 'close' | 'mouse' | 'book';

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    overview: (
      <>
        <path d="m3 17 6-11 5 8 3-5 5 8H3Z" />
        <path d="m7 10 2 1 2-1M3 21h19" />
      </>
    ),
    orioles: (
      <>
        <path d="M12 21V4m0 7C4 12 3 5 3 5s8-1 9 6Zm0 6c8 1 9-6 9-6s-8-1-9 6Z" />
      </>
    ),
    egrets: (
      <>
        <path d="M3 16c3-1 5-3 6-6 3 4 5 4 7 1l4-2-1-2-4 1c-4 2-5-2-8-4 0 5-2 8-4 9m10 0 3 7m-1-1 4-1" />
      </>
    ),
    window: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="1" />
        <path d="m5 17 5-7 4 5 3-4 3 6M3 7h18" />
      </>
    ),
    boats: (
      <>
        <path d="M3 16h18l-3 4H6l-3-4ZM12 3v13M12 4l6 9h-6M3 23c3-2 5-2 8 0 3-2 6-2 10 0" />
      </>
    ),
    pause: (
      <>
        <path d="M8 5v14M16 5v14" />
      </>
    ),
    play: <path d="m8 4 12 8-12 8V4Z" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    motion: (
      <>
        <path d="M4 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M5 16h4" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    mouse: (
      <>
        <rect x="6" y="3" width="12" height="18" rx="6" />
        <path d="M12 3v6" />
      </>
    ),
    book: (
      <>
        <path d="M12 5v16M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2V4Z" />
      </>
    ),
  };
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
