"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useLocale } from "../../components/LocaleProvider";
import { getDictionary, type Dictionary } from "../../dictionaries";
import { formatDate, parseDateKey } from "../../lib/formatDate";
import styles from "./DatePicker.module.css";

const WEEKDAY_COUNT = 7;
const CALENDAR_CELL_COUNT = 42;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A valid YYYY-MM-DD key, or "" for anything else. */
function normalizeDateKey(key: string | null | undefined): string {
  const date = parseDateKey(key);
  return date ? toDateKey(date) : "";
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonths(date: Date, months: number): Date {
  const targetMonth = date.getMonth() + months;
  const lastDay = new Date(date.getFullYear(), targetMonth + 1, 0).getDate();
  return new Date(date.getFullYear(), targetMonth, Math.min(date.getDate(), lastDay));
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

interface DatePickerProps {
  /** Renders a hidden input with this name so plain forms (FormData) get the value. */
  name?: string;
  /** Uncontrolled initial value, YYYY-MM-DD. */
  defaultValue?: string | null;
  /** Controlled value, YYYY-MM-DD or "" for none; pair with onChange. */
  value?: string;
  onChange?: (value: string) => void;
  id?: string;
  disabled?: boolean;
  /** Wording overrides for sections with their own voice (the library uses sentence case). */
  labels?: Partial<Pick<Dictionary, DateLabelKey>>;
}

type DateLabelKey =
  | "date_today"
  | "date_clear"
  | "date_choose"
  | "date_previous_month"
  | "date_next_month"
  | "date_previous_year"
  | "date_next_year";

export default function DatePicker({
  name,
  defaultValue,
  value: controlledValue,
  onChange,
  id,
  disabled,
  labels,
}: DatePickerProps) {
  const locale = useLocale();
  const dict = { ...getDictionary(locale), ...labels };

  const [uncontrolledValue, setUncontrolledValue] = useState(() => normalizeDateKey(defaultValue));
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? normalizeDateKey(controlledValue) : uncontrolledValue;
  const setValue = (next: string) => {
    if (!isControlled) setUncontrolledValue(next);
    onChange?.(next);
  };
  const [open, setOpen] = useState(false);
  const [focusDate, setFocusDate] = useState<Date>(() => parseDateKey(controlledValue ?? defaultValue) ?? new Date());

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const daysRef = useRef<HTMLDivElement>(null);
  const skipGridFocus = useRef(false);

  const formatters = useMemo(() => {
    const tag = locale === "tr" ? "tr-TR" : "en-US";
    const firstDayOfWeek = locale === "tr" ? 1 : 0;
    const weekday = new Intl.DateTimeFormat(tag, { weekday: "short" });

    return {
      firstDayOfWeek,
      month: new Intl.DateTimeFormat(tag, { month: "long" }),
      weekdays: Array.from({ length: WEEKDAY_COUNT }, (_, index) =>
        weekday.format(new Date(2024, 0, 7 + firstDayOfWeek + index)),
      ),
    };
  }, [locale]);

  const todayKey = toDateKey(new Date());
  const focusKey = toDateKey(focusDate);
  const selectedDate = parseDateKey(value);

  const monthStart = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
  const leadingDays = (monthStart.getDay() - formatters.firstDayOfWeek + WEEKDAY_COUNT) % WEEKDAY_COUNT;
  const days = Array.from({ length: CALENDAR_CELL_COUNT }, (_, index) => addDays(monthStart, index - leadingDays));
  const monthTitle = `${formatters.month.format(monthStart)} ${monthStart.getFullYear()}`;
  const triggerText = selectedDate ? formatDate(selectedDate, locale) : "";

  useEffect(() => {
    if (!open) {
      skipGridFocus.current = false;
      return;
    }

    if (skipGridFocus.current) {
      skipGridFocus.current = false;
      return;
    }

    daysRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focusKey}"]`)?.focus();
  }, [open, focusKey]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const closeAndFocusTrigger = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const selectDate = (date: Date) => {
    setValue(toDateKey(date));
    setFocusDate(date);
    closeAndFocusTrigger();
  };

  const clearDate = () => {
    setValue("");
    closeAndFocusTrigger();
  };

  const openPopover = () => {
    setFocusDate(parseDateKey(value) ?? new Date());
    setOpen(true);
  };

  const moveMonth = (offset: number) => {
    // Keep focus on the header button instead of pulling it into the grid.
    skipGridFocus.current = true;
    setFocusDate((current) => addMonths(current, offset));
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!open || event.key !== "Escape") return;
    event.preventDefault();
    closeAndFocusTrigger();
  };

  const handleGridKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.dataset.date) return;

    const offsetFromWeekStart = (focusDate.getDay() - formatters.firstDayOfWeek + WEEKDAY_COUNT) % WEEKDAY_COUNT;
    let next: Date;

    switch (event.key) {
      case "ArrowLeft":
        next = addDays(focusDate, -1);
        break;
      case "ArrowRight":
        next = addDays(focusDate, 1);
        break;
      case "ArrowUp":
        next = addDays(focusDate, -WEEKDAY_COUNT);
        break;
      case "ArrowDown":
        next = addDays(focusDate, WEEKDAY_COUNT);
        break;
      case "PageUp":
        next = addMonths(focusDate, -1);
        break;
      case "PageDown":
        next = addMonths(focusDate, 1);
        break;
      case "Home":
        next = addDays(focusDate, -offsetFromWeekStart);
        break;
      case "End":
        next = addDays(focusDate, WEEKDAY_COUNT - 1 - offsetFromWeekStart);
        break;
      default:
        return;
    }

    event.preventDefault();
    setFocusDate(next);
  };

  return (
    <div className={styles.wrapper} ref={wrapperRef} onKeyDown={handleKeyDown}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        id={id}
        ref={triggerRef}
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPopover())}
      >
        <span className={styles.value}>{triggerText}</span>
        <span className={styles.caret} aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className={styles.popover} role="dialog" aria-label={dict.date_choose}>
          <div className={styles.header}>
            <div className={styles.navGroup}>
              <button
                type="button"
                className={styles.navButton}
                aria-label={dict.date_previous_year}
                onClick={() => moveMonth(-12)}
              >
                «
              </button>
              <button
                type="button"
                className={styles.navButton}
                aria-label={dict.date_previous_month}
                onClick={() => moveMonth(-1)}
              >
                ‹
              </button>
            </div>
            <span className={styles.title} aria-live="polite">
              {monthTitle}
            </span>
            <div className={styles.navGroup}>
              <button
                type="button"
                className={styles.navButton}
                aria-label={dict.date_next_month}
                onClick={() => moveMonth(1)}
              >
                ›
              </button>
              <button
                type="button"
                className={styles.navButton}
                aria-label={dict.date_next_year}
                onClick={() => moveMonth(12)}
              >
                »
              </button>
            </div>
          </div>

          <div className={styles.weekdays} aria-hidden="true">
            {formatters.weekdays.map((weekday) => (
              <span key={weekday} className={styles.weekday}>
                {weekday}
              </span>
            ))}
          </div>

          <div className={styles.days} ref={daysRef} onKeyDown={handleGridKeyDown}>
            {days.map((day) => {
              const key = toDateKey(day);
              const isSelected = key === value;
              const isToday = key === todayKey;
              const isOutside = !isSameMonth(day, focusDate);
              const dayClassName = [
                styles.day,
                isOutside ? styles.outside : "",
                isToday ? styles.today : "",
                isSelected ? styles.selected : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={key}
                  type="button"
                  className={dayClassName}
                  data-date={key}
                  tabIndex={key === focusKey ? 0 : -1}
                  aria-label={formatDate(day, locale)}
                  aria-current={isToday ? "date" : undefined}
                  aria-pressed={isSelected}
                  onClick={() => selectDate(day)}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className={styles.footer}>
            <button type="button" className="btnGhost" onClick={() => selectDate(new Date())}>
              {dict.date_today}
            </button>
            <button type="button" className="btnGhost" onClick={clearDate}>
              {dict.date_clear}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
