// Index 0 = rating 1 (very unhappy) … index 4 = rating 5 (very happy).
export const SURVEY_FACES = ["😞", "🙁", "😐", "🙂", "😄"] as const;

// Used whenever the company hasn't customized the survey invitation email.
// {subject} is replaced with the ticket subject.
export const DEFAULT_SURVEY_EMAIL_BODY =
  'Your request "{subject}" has been resolved.\n\nWe\'d appreciate a minute of your time to tell us how we did.';
export const DEFAULT_SURVEY_LINK_TEXT = "Take the survey";
export const MAX_SURVEY_EMAIL_BODY_LENGTH = 4000;
export const MAX_SURVEY_LINK_TEXT_LENGTH = 100;
