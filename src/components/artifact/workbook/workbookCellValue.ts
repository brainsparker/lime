export function isValidWorkbookCellInput(value: string): boolean {
  return (
    value.length <= 32767 &&
    !Array.from(value).some((char) => {
      const code = char.charCodeAt(0);
      return code < 32 && code !== 9 && code !== 10 && code !== 13;
    })
  );
}
