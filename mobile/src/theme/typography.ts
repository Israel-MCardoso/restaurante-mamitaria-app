import { colors } from './colors';

export const typography = {
  hero: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: colors.darkText,
    lineHeight: 38,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.darkText,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.darkText,
    lineHeight: 24,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  overline: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.textMuted,
    lineHeight: 16,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.white,
    lineHeight: 22,
  }
};
