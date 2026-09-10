'use client';

import { useEffect } from 'react';

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,128}$/;
const phoneRule = /^[+\d\s()-]{7,25}$/;

function fieldLabel(field: Field) {
  const label = field.closest('label') as HTMLLabelElement | null;
  return label?.childNodes[0]?.textContent?.trim() || field.name || 'This field';
}

function messageFor(field: Field, form: HTMLFormElement) {
  const value = field.value.trim();
  const label = fieldLabel(field);
  const checkable = field instanceof HTMLInputElement && ['checkbox', 'radio'].includes(field.type);
  if (field.required && ((checkable && !field.checked) || (!checkable && !value))) return `${label} is required.`;
  if (!value) return '';
  if (field instanceof HTMLInputElement && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address.';
  if (field instanceof HTMLInputElement && field.type === 'tel' && !phoneRule.test(value)) return 'Please enter a valid phone number using digits and, if needed, +, spaces, brackets, or hyphens.';
  if (field instanceof HTMLInputElement && field.type === 'password' && field.autocomplete === 'new-password' && !passwordRule.test(value)) return 'Use at least 12 characters with an uppercase letter, a lowercase letter, and a number.';
  if (field.dataset.match) {
    const other = form.elements.namedItem(field.dataset.match);
    if (other instanceof HTMLInputElement && value !== other.value) return 'The passwords do not match.';
  }
  if (field.validity.badInput) return `${label} must be a valid number.`;
  if (field instanceof HTMLInputElement && field.validity.rangeUnderflow) return `${label} must be at least ${field.min}.`;
  if (field instanceof HTMLInputElement && field.validity.rangeOverflow) return `${label} must be no more than ${field.max}.`;
  if (field instanceof HTMLInputElement && field.validity.stepMismatch) return `${label} must use increments of ${field.step}.`;
  if (field.validity.tooShort && 'minLength' in field) return `${label} must be at least ${field.minLength} characters.`;
  if (field.validity.tooLong && 'maxLength' in field) return `${label} must be no more than ${field.maxLength} characters.`;
  if (field.validity.patternMismatch) return field.dataset.patternMessage || `Please enter a valid ${label.toLowerCase()}.`;
  if (field.validity.typeMismatch) return `Please enter a valid ${label.toLowerCase()}.`;
  return '';
}

function errorId(field: Field) {
  if (!field.id) field.id = `field-${crypto.randomUUID()}`;
  return `${field.id}-error`;
}

function showError(field: Field, message: string) {
  const id = errorId(field);
  let node = document.getElementById(id);
  if (!message) {
    node?.remove();
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
    return;
  }
  if (!node) {
    const error = document.createElement('span');
    error.id = id;
    error.className = 'field-error';
    error.setAttribute('role', 'alert');
    const parent = (field.closest('label') as HTMLElement | null) ?? field.parentElement;
    parent?.appendChild(error);
    node = error;
  }
  node.textContent = message;
  field.setAttribute('aria-invalid', 'true');
  field.setAttribute('aria-describedby', id);
}

function formFields(form: HTMLFormElement): Field[] {
  const controls = Array.from(form.elements) as unknown as Field[];
  return controls.filter(item => item instanceof HTMLInputElement || item instanceof HTMLSelectElement || item instanceof HTMLTextAreaElement)
    .filter(item => !item.disabled && !(item instanceof HTMLInputElement && ['hidden', 'submit', 'button'].includes(item.type)));
}

export function FormValidation() {
  useEffect(() => {
    const prepare = (root: Document | HTMLElement = document) => root.querySelectorAll('form').forEach(form => form.setAttribute('novalidate', ''));
    prepare();
    const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
      if (node instanceof HTMLElement) {
        if (node.matches('form')) node.setAttribute('novalidate', '');
        prepare(node);
      }
    })));
    observer.observe(document.body, { childList: true, subtree: true });
    const submit = (event: SubmitEvent) => {
      if (!(event.target instanceof HTMLFormElement)) return;
      const form = event.target;
      const items = formFields(form).map(field => ({ field, message: messageFor(field, form) }));
      items.forEach(({ field, message }) => showError(field, message));
      const invalid = items.filter(item => item.message);
      if (invalid.length) {
        event.preventDefault();
        event.stopImmediatePropagation();
        invalid[0].field.focus();
      }
    };
    const update = (event: Event) => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) || !field.form) return;
      const form = field.form;
      showError(field, messageFor(field, form));
      formFields(form).filter(item => item.dataset.match === field.name).forEach(item => showError(item, messageFor(item, form)));
    };
    document.addEventListener('submit', submit, true);
    document.addEventListener('input', update, true);
    document.addEventListener('change', update, true);
    return () => {
      observer.disconnect();
      document.removeEventListener('submit', submit, true);
      document.removeEventListener('input', update, true);
      document.removeEventListener('change', update, true);
    };
  }, []);
  return null;
}
