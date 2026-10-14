import { changeInputValue, clickElement, focusElement, mouseOverElement } from '@src/util';
import { waitUntil } from '@src/utils/wait';
import { sleep } from '@src/utils/sleep';

// Suggestions render inside the UserSelector container itself (no portal), as
// react-autowhatever <li role="option"> rows with no further wrapper or name span -
// the whole row's textContent is just the username.
// This function must be called from a user click: typing queries the server.
export async function selectRecipient(container: Element, username: string): Promise<boolean> {
  const input = _$(container, C.UserSelector.input) as HTMLInputElement | undefined;
  if (!input) {
    return false;
  }

  focusElement(input);
  changeInputValue(input, username);

  const findMatch = () =>
    _$$(container, C.UserSelector.suggestion).find(
      x => x.textContent?.trim().toLowerCase() === username.trim().toLowerCase(),
    );
  await waitUntil(() => !!findMatch(), 5000);
  const match = findMatch() as HTMLElement | undefined;
  if (!match) {
    return false;
  }

  // Let react-autowhatever update the highlighted suggestion before clicking.
  mouseOverElement(container as HTMLElement, match);
  await sleep(0);
  await clickElement(match);
  return true;
}
