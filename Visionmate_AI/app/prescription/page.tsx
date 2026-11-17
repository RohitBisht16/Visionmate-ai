export type MedicineRow = {
  medicine: string;
  generic_name: string;
  strength: string;
  frequency: string;
  duration: string;
  instructions: string;
  confidence: number | null;
};

/**
 * Cleans stray OCR artifacts and normalizes whitespace in a line of text.
 */
function cleanOcrLine(line: string): string {
  if (!line) return "";
  return line.replace(/[^\w\s.,;:()\-/%]/gi, " ").replace(/\s+/g, " ").trim();
}

/**
 * Extracts the patient name from raw prescription OCR text.
 */
export function extractPatientNameFromText(text: string): string {
  if (!text) return "";
  const match = text.match(
    /patient\s*name\s*[:\-]\s*([^\n\r]+?)(?=\s+(?:age|sex|gender|mrn|date|birthdate)\b|$)/i
  );
  return match?.[1]?.trim() || "";
}

/**
 * Fallback rule-based prescription parser when AI extraction is unavailable.
 */
export function fallbackParsePrescriptionText(text: string): MedicineRow[] {
  if (!text) return [];

  const lines = text.split(/\r?\n/).map(cleanOcrLine).filter(Boolean);

  // Matches "Rx:", "Rx ", "Bx:", "Px:", or numbered/form items like "1) TAB. <medicine>"
  const rxMarkerRegex = /^(?:[rbp]\s*x)\s*[:\-]?\s+(.+)/i;
  const numberedOrFormRegex =
    /^(?:\d+\s*[.)\-:]\s*)?(?:tab(?:let)?|cap(?:sule)?|syrup|susp(?:ension)?|inj(?:ection)?|cream|ointment|drops?|inhaler)\.?\s+(.+)/i;

  const blocks: string[][] = [];
  let current: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (
      /^(?:advice|follow\s*up|substitute|dispense\s+as\s+written|prescribed\s+by|signature)\b/i.test(
        line
      )
    ) {
      if (current.length) blocks.push(current);
      current = [];
      break;
    }

    const nextLineIsSig = i + 1 < lines.length && /^sig\s*[:\-]/i.test(lines[i + 1]);

    if (
      rxMarkerRegex.test(line) ||
      numberedOrFormRegex.test(line) ||
      (nextLineIsSig && !/^(?:prescription\s*details|date\s*issued)/i.test(line))
    ) {
      if (current.length) blocks.push(current);
      current = [line];
    } else if (current.length) {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);

  return blocks
    .map((block) => {
      const fullText = block.join(" ");
      const firstLine = block[0]
        .replace(/^(?:[rbp]\s*x)\s*[:\-]?\s*/i, "")
        .replace(/^\d+\s*[.)\-:]\s*/i, "")
        .replace(/\bstart\s*date\s*[:\-].*$/i, "")
        .trim();

      const durationMatch = fullText.match(
        /\b\d+\s*(?:day|days|week|weeks|month|months)\b/i
      );
      const strengthMatch = fullText.match(
        /\b\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*(?:mg\/24\s*hours?|mg\/ml|mg|mcg|g|ml|iu|%)\b/i
      );
      const sigLine = block.find((l) => /^sig\s*[:\-]/i.test(l));
      const freqMatch = sigLine
        ? sigLine.replace(/^sig\s*[:\-]\s*/i, "").trim()
        : fullText.match(
            /\b(?:\d+\s*(?:morning|afternoon|evening|night)|once|twice|thrice|daily|bd|tds|od|hs)(?:[^.,;\n]*)/i
          )?.[0] || "";

      const dispenseLine = block.find((l) => /^dispense/i.test(l));
      const instructions = dispenseLine
        ? dispenseLine.replace(/^dispense(?:\s*\/\s*supply)?\s*[:\-]?\s*/i, "").replace(/\*/g, "").trim()
        : "";

      const nameOnly = firstLine
        .replace(
          /\b\d+\s*(?:morning|afternoon|evening|night|day|days|week|weeks).*$/i,
          ""
        )
        .trim();

      const compositionLines = block.slice(1).filter(
        (l) =>
          !/^(?:sig|dispense|supply|refill|start\s*date)\b/i.test(l) &&
          !/^\(?\s*tot\s*:/i.test(l) &&
          !/^\d+\s*days?\b/i.test(l)
      );

      return {
        medicine: nameOnly || firstLine,
        generic_name: compositionLines.join(" "),
        strength: strengthMatch?.[0] || "",
        frequency: freqMatch,
        duration: durationMatch?.[0] || "",
        instructions,
        confidence: null,
      };
    })
    .filter((row) => row.medicine.length >= 3);
}