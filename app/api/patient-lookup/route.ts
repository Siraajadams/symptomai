async function lookupPatient() {
  const cleanPatientId = patientId.replace(/\s+/g, "").trim();

  if (!cleanPatientId) {
    setLookupMessage("Enter a National ID or passport number.");
    return;
  }

  setSearching(true);
  setLookupMessage("");

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("/api/patient-lookup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        patientId: cleanPatientId,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    const responseText = await response.text();

    let data: any = null;

    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      throw new Error(
        responseText || "The patient lookup returned an invalid response."
      );
    }

    if (!response.ok) {
      throw new Error(data?.error || "Patient lookup failed.");
    }

    if (data?.found && data?.patient) {
      const patient = data.patient;

      setFirstName(patient.firstName || patient.first_name || "");
      setSurname(patient.surname || "");
      setEmail(patient.email || "");
      setMobile(patient.mobile || "");
      setGender(patient.gender || "");
      setDateOfBirth(patient.dateOfBirth || patient.date_of_birth || "");

      setLookupMessage(
        `Existing patient found: ${
          patient.firstName || patient.first_name || ""
        } ${patient.surname || ""}`.trim()
      );
    } else {
      setLookupMessage(
        "No existing patient was found. Please continue completing the form."
      );
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      setLookupMessage(
        "The patient search took too long. Please check your connection and try again."
      );
    } else {
      setLookupMessage(
        error instanceof Error
          ? error.message
          : "The patient search could not be completed."
      );
    }
  } finally {
    window.clearTimeout(timeout);
    setSearching(false);
  }
}
