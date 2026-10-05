// ========================================================
// ModalManager.jsx — FINAL FULL VERSION
// Correct imports for your actual filesystem
// ========================================================

import React from "react";

import AgreementDateModal from "./modals/AgreementDateModal.jsx";
import IrrevocableDateModal from "./modals/IrrevocableDateModal.jsx";
import IrrevocableTimeModal from "./modals/IrrevocableTimeModal.jsx";
import CompletionDateModal from "./modals/CompletionDateModal.jsx";
import TitleSearchDateModal from "./modals/TitleSearchDateModal.jsx";
import AddressModal from "./modals/AddressModal.jsx";
import MlsUploadModal from "./modals/MlsUploadModal.jsx";
import FormsPickerModal from "./modals/FormsPickerModal.jsx";
import ClausesPickerModal from "./modals/ClausesPickerModal.jsx";
import SchedulePickerModal from "./modals/SchedulePickerModal.jsx";



export function ModalManager({
  modalState,
  modalData,
  setModalState,
  setModalData,
  deal,
  setDeal,
  onAddressSaved,
  onMlsPdfSelected,
  onModalSave,
  availableForms,
  activeForms,
  selectedForm,
  setActiveForms,
  setSelectedForm
}) {
  if (!modalState) return null;

  // ----------- Helpers -----------
  function close(key) {
    setModalState((m) => ({ ...m, [key]: false }));
  }

  function saveAndClose(qid, value, key) {
    onModalSave(qid, value);
    close(key);
  }

  // ======================================================
  // AGREEMENT DATE
  // ======================================================
  if (modalState.showAgreementDate) {
    return (
      <AgreementDateModal
        isOpen
        onClose={() => close("showAgreementDate")}
        onSave={(val) => saveAndClose("agreementDate", val, "showAgreementDate")}
      />
    );
  }

  // ======================================================
  // IRREVOCABLE DATE
  // ======================================================
  if (modalState.showIrrevDate) {
    return (
      <IrrevocableDateModal
        isOpen
        onClose={() => close("showIrrevDate")}
        onSave={(val) => saveAndClose("irrevocableDate", val, "showIrrevDate")}
      />
    );
  }

  // ======================================================
  // IRREVOCABLE TIME
  // ======================================================
  if (modalState.showIrrevTime) {
    return (
      <IrrevocableTimeModal
        isOpen
        onClose={() => close("showIrrevTime")}
        onSave={(val) => saveAndClose("irrevocableTime", val, "showIrrevTime")}
      />
    );
  }

  // ======================================================
  // COMPLETION DATE
  // ======================================================
  if (modalState.showCompletionDate) {
    return (
      <CompletionDateModal
        isOpen
        onClose={() => close("showCompletionDate")}
        onSave={(val) => saveAndClose("completionDate", val, "showCompletionDate")}
      />
    );
  }

  // ======================================================
  // TITLE SEARCH DATE
  // ======================================================
  if (modalState.showTitleDate) {
    return (
      <TitleSearchDateModal
        isOpen
        onClose={() => close("showTitleDate")}
        onSave={(val) => saveAndClose("titleSearch", val, "showTitleDate")}
      />
    );
  }

  // ======================================================
  // ADDRESS ENTRY MODAL
  // ======================================================
  if (modalState.showAddress) {
    return (
      <AddressModal
        isOpen
        onClose={() => close("showAddress")}
        onSave={(raw) => {
          onAddressSaved(raw);
          close("showAddress");
        }}
      />
    );
  }

  // ======================================================
  // MLS PDF UPLOAD
  // ======================================================
  if (modalState.showMlsUpload) {
    return (
      <MlsUploadModal
        isOpen
        onClose={() => close("showMlsUpload")}
        onFileSelected={(file) => {
          onMlsPdfSelected(file);
          close("showMlsUpload");
        }}
      />
    );
  }

  // ======================================================
  // FORMS PICKER
  // ======================================================
  if (modalState.showFormsPicker) {
    return (
      <FormsPickerModal
        isOpen
        availableForms={availableForms}
        activeForms={activeForms}
        selectedForm={selectedForm}
        onClose={() => close("showFormsPicker")}
        onApply={(forms, selected) => {
          setActiveForms(forms);
          setSelectedForm(selected);
          close("showFormsPicker");
        }}
      />
    );
  }

  // ======================================================
  // CLAUSES PICKER
  // ======================================================
  if (modalState.showClausePicker) {
    return (
      <ClausesPickerModal
        isOpen
        deal={deal}
        setDeal={setDeal}
        onClose={() => close("showClausePicker")}
        onSave={(clauses) => {
          setDeal((d) => ({ ...d, clauses }));
          close("showClausePicker");
        }}
      />
    );
  }

  // ======================================================
  // SCHEDULE PICKER
  // ======================================================
  if (modalState.showSchedulePicker) {
    return (
      <SchedulePickerModal
        isOpen
        onClose={() => close("showSchedulePicker")}
        onSave={(schedules) => {
          setDeal((d) => ({ ...d, schedules }));
          close("showSchedulePicker");
        }}
      />
    );
  }

  // ======================================================
  // DEFAULT: nothing open
  // ======================================================
  return null;
}
