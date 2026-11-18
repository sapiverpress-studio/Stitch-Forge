export function normaliseHexColour(value) {
  const match = /^#?([a-f0-9]{6})$/i.exec(value.trim());
  return match ? `#${match[1].toUpperCase()}` : null;
}

export function bindColourInput(picker, hex, error, onChange) {
  function clearError() {
    hex.removeAttribute('aria-invalid');
    error.hidden = true;
  }

  function setColour(colour) {
    picker.value = colour.toLowerCase();
    if (hex.ownerDocument.activeElement !== hex) hex.value = colour.toUpperCase();
    clearError();
  }

  function commit() {
    const colour = normaliseHexColour(hex.value);
    if (!colour) {
      hex.setAttribute('aria-invalid', 'true');
      error.hidden = false;
      return;
    }
    hex.value = colour;
    setColour(colour);
    onChange(colour.toLowerCase());
  }

  picker.addEventListener('input', () => {
    setColour(picker.value);
    onChange(picker.value);
  });
  hex.addEventListener('input', () => {
    clearError();
    const colour = normaliseHexColour(hex.value);
    if (!colour) return;
    picker.value = colour.toLowerCase();
    onChange(colour.toLowerCase());
  });
  hex.addEventListener('change', commit);
  hex.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    commit();
  });

  return { setColour, focus() { hex.focus(); hex.scrollIntoView({ block: 'nearest' }); } };
}
