import React, { useId, useState, useRef } from "react";
export default function AdminSelect({ children, value, onChange, required }) {
  const id = useId(),
    root = useRef(null);
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const flatten = (c) =>
    React.Children.toArray(c).flatMap((x) =>
      Array.isArray(x)
        ? flatten(x)
        : x?.type === React.Fragment
          ? flatten(x.props.children)
          : [x],
    );
  const text = (c) =>
    React.Children.toArray(c)
      .map((x) => (typeof x === "object" ? text(x.props?.children) : x))
      .join("");
  const options = flatten(children)
    .filter((x) => x?.type === "option")
    .map((x) => ({
      value: x.props.value ?? text(x.props.children),
      label: text(x.props.children),
      disabled: x.props.disabled,
    }));
  const selected = options.find((x) => x.value === value);
  const filtered = options.filter(
    (x) =>
      !x.disabled &&
      x.value !== "" &&
      x.label.toLowerCase().includes(query.toLowerCase()),
  );
  const choose = (o) => {
    onChange({ target: { value: o.value } });
    setOpen(false);
    setQuery("");
  };
  return (
    <div
      className="admin-select"
      ref={root}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setOpen(false);
          setQuery("");
        }
      }}
    >
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={id}
        aria-autocomplete="list"
        aria-activedescendant={
          open && filtered[active] ? `${id}-${active}` : undefined
        }
        required={required && !value}
        value={open ? query : value ? selected?.label || "" : ""}
        placeholder={selected?.label || "Search or choose…"}
        onFocus={() => {
          setOpen(true);
          setQuery("");
          setActive(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
            setQuery("");
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActive((n) => {
              const next = Math.max(
                0,
                Math.min(
                  filtered.length - 1,
                  n + (e.key === "ArrowDown" ? 1 : -1),
                ),
              );
              root.current
                ?.querySelectorAll("[role=option]")
                [next]?.scrollIntoView({ block: "nearest" });
              return next;
            });
          }
          if (e.key === "Enter" && open) {
            e.preventDefault();
            if (filtered[active]) choose(filtered[active]);
          }
        }}
      />
      <span className="select-chevron" aria-hidden="true">
        ⌄
      </span>
      {open && (
        <div className="admin-select-options" role="listbox" id={id}>
          {filtered.map((o, i) => (
            <div
              role="option"
              aria-selected={value === o.value}
              id={`${id}-${i}`}
              key={o.value}
              className={i === active ? "highlight" : ""}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
            >
              {o.label}
            </div>
          ))}
          {!filtered.length && <p>No matches</p>}
        </div>
      )}
    </div>
  );
}
