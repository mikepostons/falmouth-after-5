import {
  Wine,
  ForkKnife,
  ShoppingBag,
  Ticket,
  PaintBrush,
  Heart,
  House,
  MapTrifold,
  List,
  MagnifyingGlass,
  ArrowRight,
  ArrowUpRight,
  X,
  Clock,
  MapPin,
  SlidersHorizontal,
  CalendarBlank,
  ArrowLeft,
  Plus,
  SignOut,
  Check,
  WarningCircle,
  Compass,
  Eye,
  PencilSimple,
  Copy,
  UploadSimple,
  ArrowClockwise,
  Gear,
  Lock,
  FloppyDisk,
  Globe,
  Phone,
  FacebookLogo,
  InstagramLogo,
} from "@phosphor-icons/react";
export const icons = {
  drinks: Wine,
  food: ForkKnife,
  shopping: ShoppingBag,
  entertainment: Ticket,
  ticket: Ticket,
  experiences: PaintBrush,
  wellbeing: Heart,
  stay: House,
  map: MapTrifold,
  list: List,
  search: MagnifyingGlass,
  right: ArrowRight,
  external: ArrowUpRight,
  close: X,
  clock: Clock,
  pin: MapPin,
  filter: SlidersHorizontal,
  calendar: CalendarBlank,
  back: ArrowLeft,
  plus: Plus,
  logout: SignOut,
  check: Check,
  warning: WarningCircle,
  compass: Compass,
  eye: Eye,
  edit: PencilSimple,
  copy: Copy,
  upload: UploadSimple,
  refresh: ArrowClockwise,
  settings: Gear,
  lock: Lock,
  save: FloppyDisk,
  globe: Globe,
  phone: Phone,
  facebook: FacebookLogo,
  instagram: InstagramLogo,
};
export default function Icon({ name, size = 20, ...props }) {
  if (/^uploads\/[a-f0-9]{32}\.svg$/.test(name || ""))
    return (
      <img
        src={"./" + name}
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
        {...props}
      />
    );
  const I = icons[name] || MapPin;
  return <I size={size} weight="regular" aria-hidden="true" {...props} />;
}
