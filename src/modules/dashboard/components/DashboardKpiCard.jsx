const COLOR_CLASSES = {
  emerald: "bg-emerald-100 text-emerald-600",
  blue: "bg-blue-100 text-blue-600",
  amber: "bg-amber-100 text-amber-600",
  purple: "bg-purple-100 text-purple-600",
  sky: "bg-sky-100 text-sky-600",
  red: "bg-red-100 text-red-600",
  slate: "bg-slate-200 text-slate-600",
};

export const DashboardKpiCard = ({
  label,
  value,
  icon: Icon,
  color = "blue",
  valueClassName = "text-slate-900",
}) => (
  <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
    <div>
      <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
        {label}
      </p>
      <h3 className={`text-xl sm:text-2xl font-black mt-1 ${valueClassName}`}>
        {value}
      </h3>
    </div>
    <div className={`p-3 rounded-lg shrink-0 ${COLOR_CLASSES[color]}`}>
      <Icon className="w-6 h-6" />
    </div>
  </div>
);
