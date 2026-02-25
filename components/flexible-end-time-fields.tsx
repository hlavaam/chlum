"use client";

import { useState } from "react";

type Props = {
  timeLabel: string;
  checkboxLabel?: string;
  defaultTime?: string;
  defaultFlexible?: boolean;
  required?: boolean;
};

export function FlexibleEndTimeFields({
  timeLabel,
  checkboxLabel = "Čas do podle situace",
  defaultTime = "",
  defaultFlexible = false,
  required = false,
}: Props) {
  const [flexible, setFlexible] = useState(defaultFlexible);
  const [timeValue, setTimeValue] = useState(defaultTime);

  return (
    <>
      <label>
        {timeLabel}
        {flexible ? (
          <input type="text" value="??:??" disabled aria-label={`${timeLabel} (podle situace)`} />
        ) : (
          <input
            type="time"
            name="endTime"
            value={timeValue}
            required={required}
            onChange={(event) => setTimeValue(event.target.value)}
          />
        )}
      </label>
      <label className="inline">
        <input
          type="checkbox"
          name="endTimeFlexible"
          checked={flexible}
          onChange={(event) => setFlexible(event.target.checked)}
        />
        {checkboxLabel}
      </label>
    </>
  );
}
