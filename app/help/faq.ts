import { MEMBERSHIP_PRICES } from '@/lib/payfast'
import { NEW_MEMBER_UNLIMITED_MESSAGES_DAYS, PLANS } from '@/lib/plans'
import { FOUNDING_MEMBER_LIMIT } from '@/lib/founding'

/**
 * Help Centre FAQ. Answers are plain text; `[label](/path)` becomes a link.
 * Plan numbers come from lib/plans.ts and lib/payfast.ts so the copy can't drift.
 */
export interface Faq { q: string; a: string }
export interface FaqSection { id: string; title: string; items: Faq[] }

const r = (n: number) => `R${n.toLocaleString('en-ZA')}`

export function buildFaq(): FaqSection[] {
  const free = PLANS.FREE
  return [
    {
      id: 'getting-started',
      title: 'Getting started',
      items: [
        {
          q: 'What is Unbound?',
          a: 'Unbound is a private, members-first dating community for singles and couples in South Africa. You can browse members, like or wink at people in Discover, chat with your matches, and join events and forums.',
        },
        {
          q: 'Who can join?',
          a: 'Anyone aged 18 or older. Unbound is strictly adults-only — if we find an account belongs to someone under 18, we close it. See our [Terms of Service](/terms).',
        },
        {
          q: 'Is it free to join?',
          a: 'Yes. Joining and the Free plan cost nothing and don’t need a card. Gold and Platinum are optional paid plans — see [Pricing](/pricing).',
        },
        {
          q: 'Why do I need to confirm my email?',
          a: 'It keeps fake accounts out and makes sure we can reach you about your account. Check your inbox (and spam folder) for our email and tap the link. If it didn’t arrive, you can resend it from the confirmation screen.',
        },
        {
          q: 'What do I need to finish before I can browse?',
          a: 'Setting up takes two quick steps: fill in the basics (name, gender, city and who you’re interested in) and add at least one photo. Once that’s done, the Members grid, Discover, Matches and Messages open up.',
        },
        {
          q: 'I forgot my password. What now?',
          a: 'Use “Forgot password” on the [sign-in page](/auth/signin). We’ll email you a link to choose a new one. The link expires, so use it soon.',
        },
      ],
    },
    {
      id: 'profile',
      title: 'Profile & photos',
      items: [
        {
          q: 'How do I edit my profile?',
          a: 'Open [My Profile](/profile) from the account menu. You can update your details, bio and photos at any time — a fuller profile gets far more attention.',
        },
        {
          q: 'How do I get the verified tick?',
          a: 'Go to [Settings](/account) → Profile Verification and upload a clear selfie. Our team checks it against your photos and adds the tick once you’re approved.',
        },
        {
          q: 'Can other members save or screenshot my photos?',
          a: 'Saving is blocked across Unbound, and every photo carries a watermark with the viewer’s username, so a copy leads straight back to them. No website can fully stop a screenshot, though — read more in the [Safety Centre](/safety).',
        },
        {
          q: 'We’re a couple — can we have a joint profile?',
          a: 'Yes. If you each have your own account, use “Link with your partner” on [My Profile](/profile) so you appear together as a couple. Either of you can unlink at any time.',
        },
        {
          q: 'What is a founding member?',
          a: `The first ${FOUNDING_MEMBER_LIMIT} women and couples to join get Platinum free, forever, plus a numbered founding member badge. Your spot is claimed automatically when you finish your profile.`,
        },
      ],
    },
    {
      id: 'matching',
      title: 'Matching & messaging',
      items: [
        {
          q: 'How does Discover work?',
          a: 'Discover shows you one member at a time. Like or wink if you’re interested, or pass to move on. When two people like each other, it’s a match.',
        },
        {
          q: 'Where do I find my matches?',
          a: 'All your mutual likes live on the Matches page. Tap a match to start chatting.',
        },
        {
          q: 'What can I send in messages?',
          a: 'Text, photos and emoji reactions. Keep it friendly — messages that break our [Terms](/terms) can lead to a suspension.',
        },
        {
          q: 'Is there a limit on messages?',
          a: `On the Free plan, messaging is unlimited for your first ${NEW_MEMBER_UNLIMITED_MESSAGES_DAYS} days, then ${free.messagesPer24h} messages per 24 hours, with ${free.likesPerDay} likes a day. Gold and Platinum have unlimited messages and likes. See [Pricing](/pricing).`,
        },
        {
          q: 'Can I choose who’s allowed to message me?',
          a: 'Yes. In [Settings](/account) → Who can message me, choose Everyone, Verified members only, or Only people I’ve liked.',
        },
        {
          q: 'How do I unmatch someone?',
          a: 'Tap the ⋯ menu in your chat with them, or on their card on the Matches page, and choose Unmatch. It ends the match and the chat for both of you, and neither of you can message the other again.',
        },
        {
          q: 'What are Events and Forums?',
          a: 'Events lists meet-ups you can RSVP to, and Forums is where members chat in topic threads. Both are open to every member.',
        },
      ],
    },
    {
      id: 'safety',
      title: 'Safety & privacy',
      items: [
        {
          q: 'How do I block or report someone?',
          a: 'On a profile, use the block or flag button. In a chat or on a Matches card, use the ⋯ menu. Reports are confidential — the member is never told who reported them — and our team reviews every one.',
        },
        {
          q: 'What should I report?',
          a: 'Anyone asking for money, pressuring you to move off the platform, using fake or stolen photos, harassing or threatening you, sharing your photos outside Unbound, or who seems to be under 18.',
        },
        {
          q: 'Any tips for meeting someone in person?',
          a: 'Video call first, meet somewhere public, tell a friend and arrange your own transport. Our [Safety Centre](/safety) has more tips, emergency numbers and Share My Date. In an emergency call SAPS on 10111, or 112 from a mobile.',
        },
        {
          q: 'Can I hide my profile for a while?',
          a: 'Yes — Snooze Profile in [Settings](/account) hides you from browsing, search and Discover. Your matches and chats stay as they are, and you can un-snooze any time.',
        },
        {
          q: 'How do you use my personal information?',
          a: 'We follow South Africa’s POPIA. You can download a copy of your data from [Settings](/account) → Your Data, and ask us to correct or delete it. Full details are in our [Privacy Policy](/privacy).',
        },
      ],
    },
    {
      id: 'billing',
      title: 'Membership & billing',
      items: [
        {
          q: 'What’s the difference between Free, Gold and Platinum?',
          a: 'Free lets you join, browse and start chatting. Gold adds unlimited messages and likes, see who liked you, search anywhere, advanced filters and read receipts. Platinum adds incognito browsing, a video profile and more visibility. Compare every feature on [Pricing](/pricing).',
        },
        {
          q: 'How much do Gold and Platinum cost?',
          a: `Gold is ${r(MEMBERSHIP_PRICES.GOLD.monthly)} a month or ${r(MEMBERSHIP_PRICES.GOLD.annual)} a year. Platinum is ${r(MEMBERSHIP_PRICES.PLATINUM.monthly)} a month or ${r(MEMBERSHIP_PRICES.PLATINUM.annual)} a year. All prices are in rand — see [Pricing](/pricing).`,
        },
        {
          q: 'How do I cancel my plan?',
          a: 'Open Membership from the account menu and choose “Cancel membership”. Your paid features stay until the end of the period you’ve paid for, then you move to Free. See our [Refund & Cancellation Policy](/refunds).',
        },
        {
          q: 'Can I get a refund?',
          a: 'If you cancel within 7 days of your first payment for Gold or Platinum, we refund it in full (once per member). Other cases are covered in our [Refund & Cancellation Policy](/refunds).',
        },
        {
          q: 'I was charged and don’t recognise it. What should I do?',
          a: 'Please [contact us](/help/contact) first with the date and amount — it’s usually faster than a bank dispute and we’ll sort it out quickly.',
        },
      ],
    },
    {
      id: 'account',
      title: 'Account',
      items: [
        {
          q: 'How do I change my email preferences?',
          a: 'In [Settings](/account) → Email you can turn off emails about likes, messages and tips. Account and billing emails are always sent.',
        },
        {
          q: 'How do I download my data?',
          a: 'Go to [Settings](/account) → Your Data (POPIA) and tap Download My Data. You’ll get a copy of your profile, photos, messages and activity.',
        },
        {
          q: 'How do I delete my account?',
          a: 'Go to [Settings](/account) → Delete Account and type the confirmation phrase. This can’t be undone. Some records are kept for a limited time as explained in our [Privacy Policy](/privacy).',
        },
        {
          q: 'My account was suspended. Can I appeal?',
          a: 'Yes. [Contact support](/help/contact) using the email address on your account and tell us what happened. A real person will review it.',
        },
      ],
    },
  ]
}
