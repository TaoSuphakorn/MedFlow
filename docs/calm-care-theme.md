# Calm Care theme

This visual refresh pairs a deep blue navigation rail with warm white content surfaces, sage panels and teal primary actions. Existing Inter and Noto Sans Thai fonts remain locally bundled. The larger patient names, labels and clinical text help distinguish navigation, record content and review actions.

The visual layer lives in `frontend/src/care-theme.css`, after the existing layout and responsive rules. It defines shared color tokens and component styling for login, navigation, overview, patient lists, SOAP editing and dialogs. The amber review state and explicit confirmation controls remain visible. Thai/English behavior and the mobile drawer interaction are unchanged.

The UI/UX Pro Max healthcare query recommended an accessible clinical palette, visible focus and restrained motion. Its sales landing-page pattern did not fit this authenticated workspace, so it was not applied. No remote fonts, images or dependencies were added.

Validation: Docker frontend build passed and the full browser regression suite passed 23/23 cases. The additional layout check covers a 375px login, portrait/landscape overview, reduced motion and an enlarged root font. Desktop login/overview and narrow SOAP screenshots were inspected. This is not a screen-reader or full accessibility audit. A drawer shadow visible while the menu was closed was removed after visual inspection and the responsive tests were rerun.
