/**
 * Hand-rolled 24px stroke icons. Kept inline rather than adding an icon
 * dependency — the app needs a dozen glyphs, not a library.
 */
type IconProps = React.SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-full"
      {...props}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6 18 18M18 6 6 18" />
  </Icon>
);

export const MenuIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h13M12.5 6l5.5 6-5.5 6" />
  </Icon>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 12H6M11.5 6 6 12l5.5 6" />
  </Icon>
);

export const MapPinIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </Icon>
);

export const ExternalLinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 4h6v6M20 4l-8.5 8.5" />
    <path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10" />
  </Icon>
);

export const ChatIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 12.5c0 4-3.6 7-8 7a9.3 9.3 0 0 1-2.7-.4L4.5 21l1.2-3.6A6.7 6.7 0 0 1 4 12.5c0-4 3.6-7 8-7s8 3 8 7Z" />
  </Icon>
);

export const SendIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 12 20 4.5 15.5 20l-4-6.5-7-1.5Z" />
  </Icon>
);

export const SlidersIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 8h14M5 16h14" />
    <circle cx="10" cy="8" r="2.2" />
    <circle cx="15" cy="16" r="2.2" />
  </Icon>
);

export const InboxIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 13h4l1.5 3h5L16 13h4" />
    <path d="M5.5 5h13l1.5 8v4.5A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5V13l1.5-8Z" />
  </Icon>
);

export const BuildingIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h16" />
    <path d="M6 20V8.5L12 5l6 3.5V20" />
    <path d="M10 20v-4h4v4" />
    <path d="M9.5 11h1M13.5 11h1" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

export const StarIcon = ({
  filled = false,
  ...p
}: IconProps & { filled?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinejoin="round"
    aria-hidden="true"
    className="size-full"
    {...p}
  >
    <path d="m12 3.75 2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 17.03l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85L12 3.75Z" />
  </svg>
);

/** Wordmark glyph — a stylised open book / building roofline. */
export const LogoMark = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-full" {...p}>
    <path
      d="M12 3.2 21.2 8 12 12.8 2.8 8 12 3.2Z"
      fill="currentColor"
      fillOpacity="0.9"
    />
    <path
      d="M5.6 10.4v4.9c0 .5.26.95.7 1.2 1.5.86 3.6 1.7 5.7 1.7s4.2-.84 5.7-1.7c.44-.25.7-.7.7-1.2v-4.9"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      fillOpacity="0"
    />
  </svg>
);
