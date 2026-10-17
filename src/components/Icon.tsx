const PATHS = {
  home: "M3 11l9-8 9 8M5 10v10h14V10",
  flag: "M5 21V4m0 0h11l-2 4 2 4H5",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  map: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14",
  unit: "M14 4l6-1-1 6-9 9-3-3zM5 16l3 3M4 20l2-2",
  battle: "M12 3v4M12 17v4M3 12h4M17 12h4M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0",
  war: "M4 4l8 8M20 4l-8 8M6 14l4 4M18 14l-4 4",
  chart: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  box: "M12 3l8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10",
  briefcase: "M4 8h16v11H4zM9 8V5h6v3",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v2a3 3 0 0 0 4 2M16 6h4v2a3 3 0 0 1-4 2M12 13v4M9 20h6",
  clock: "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 7v5l3 2",
  news: "M4 5h13v14H6a2 2 0 0 1-2-2zM17 8h3v9a2 2 0 0 1-2 2M8 9h5M8 13h5",
  contract: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6",
  tool: "M14 6l4-3 3 3-3 4M3 21l9-9M10 10l4 4",
  bug: "M9 9h6v8a3 3 0 0 1-6 0zM9 12H5M15 12h4M9 16H6M15 16h3M10 6l1.5 3M14 6l-1.5 3",
  search: "M11 11m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0M16 16l5 5",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6L6 18",
  chevron: "M15 6l-6 6 6 6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
