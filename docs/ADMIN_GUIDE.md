# Speak Station administrator guide

Sign in with the configured owner account. The **Owner controls** bar and the footer **Admin** button open the administration workspace. The account email is read from the verified server identity; learner submissions cannot grant administrator access.

## Editing the website

- **Brand & theme:** name, tagline, signed-in greeting, colours, font family, base font size and question size. Use `{name}` in the signed-in greeting.
- **Page copy:** search the current wording and replace any heading, sentence, label or helper text. An empty replacement removes that text. Restore default reverses the edit.
- **Sections:** show, hide and reorder homepage sections. Restore hidden layout elements here.
- **Collections:** add, edit or delete navigation, statistic cards, feature cards, milestones, exams, lessons and custom sections. Apply an item to the draft, then publish the website changes.
- **Edit page layout:** return to the homepage, enable layout editing and select a text, card or subsection. The element selector can choose a containing card. Save text or hide the selected element. The owner controls and access boundary remain protected.

Publish website changes saves the configuration to the server. If another tab has published newer content, reload before publishing again. Configuration is plain text and validated data; it cannot execute HTML or JavaScript.

## Topics, questions and exams

Topic and question actions publish immediately. Add a topic, then add questions for Parts 1, 2 and 3. A topic needs all three parts before it joins the daily rotation. The question editor controls the part, topic, wording, difficulty, duration, learning objective and cue points. Deletion archives questions while preserving prior answers. Rename a topic to update its question labels.

Exam collections control the visible catalogue and the learning milestone schedule. Use unique numbers and days within each exam type. Leave question IDs empty to use the daily rotation for that day, or list a custom set containing all three speaking parts. Remove question references from custom exams before deleting those questions or topics.

A recorded test passes at a practice band of 6.5/9 or above. The server requires every assigned answer to be recorded, assessed and reviewed. All four criterion estimates require sufficient audio evidence. Text-only practice cannot pass a recorded test. Practice scores are AI estimates, not official IELTS results.

## Learners and private support

Account actions require a reason and create an audit entry. Ban blocks access, including private recordings and API requests. Unban restores a suspended account. Delete removes stored learning data and recordings and retains an access tombstone preventing immediate re-registration. The owner account cannot be deleted or suspended through learner controls.

A test-pass override records the administrator, reason, test type and milestone. It is labelled as an administrative override, not an AI score. Overrides do not invent a band estimate.

Learners send support messages from the bottom of the homepage. Read and reply in **Messages**. Replies are visible only to that learner and administrators. Account management and support messages require verified sign-in; no public learner directory is exposed.
