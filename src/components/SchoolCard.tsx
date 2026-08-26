import Link from "next/link";
import { School } from "@/types";
import Badge, { khdaTone } from "./ui/Badge";
import { ArrowRightIcon, MapPinIcon } from "./icons";
import { formatFeeRange } from "@/lib/format";

export default function SchoolCard({ school }: { school: School }) {
  return (
    <Link
      href={`/schools/${school.slug}`}
      className="group flex h-full flex-col rounded-lg border border-ink-200 bg-white p-5 shadow-xs transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-semibold leading-snug text-ink-900 transition-colors group-hover:text-brand-800">
          {school.name}
        </h3>
        <Badge tone={khdaTone[school.khdaRating] ?? "neutral"} className="shrink-0">
          {school.khdaRating}
        </Badge>
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-500">
        <span className="size-3.5 shrink-0 text-ink-400">
          <MapPinIcon />
        </span>
        <span className="truncate">
          {school.area} · {school.curricula.join(" / ")}
        </span>
      </p>

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-500">
        {school.description}
      </p>

      <div className="mt-5 flex items-end justify-between gap-3 border-t border-ink-200/80 pt-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
            Annual fees
          </p>
          <p className="tabular mt-0.5 truncate text-sm font-semibold text-ink-900">
            {formatFeeRange(school.feeMinAED, school.feeMaxAED)}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-brand-700">
          Details
          <span className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5">
            <ArrowRightIcon />
          </span>
        </span>
      </div>
    </Link>
  );
}
