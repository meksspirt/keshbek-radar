export type BankId =
  | 'unex'
  | 'globus'
  | 'taskombank'
  | 'monobank'
  | 'pumb'
  | 'abank'
  | 'accordbank'
  | 'izibank'
  | 'sense'
  | 'crystalbank'
  | 'bizbank'
  | 'alliance'
  | 'creditdnepr'
  | 'raiffeisen'
  | 'privatbank'
  | 'radabank'
  | 'vstbank'
  | 'mtbbank'
  | 'ukrcapital'
  | 'ideabank'
  | 'bankkd';

export type CategoryId =
  | 'groceries'
  | 'appliances'
  | 'auto_fuel'
  | 'clothing'
  | 'cafes'
  | 'beauty'
  | 'kids'
  | 'home_repair'
  | 'pharmacy'
  | 'medicine'
  | 'utilities'
  | 'pets'
  | 'public_transport'
  | 'marketplaces'
  | 'taxi'
  | 'cinema'
  | 'books'
  | 'education'
  | 'travel'
  | 'flowers'
  | 'multimarkets'
  | 'games_fun'
  | 'sport'
  | 'ai'
  | 'all_purchases';

export type RuleType = 'CATEGORY' | 'MERCHANT' | 'ALL';
export type TaxMode = 'NET' | 'GROSS';
export type FundFilter = 'ALL' | 'OWN' | 'CREDIT';

export interface Bank {
  id: BankId;
  nameUk: string;
  shortName: string;
  defaultTaxPercent: number;
  brandColor: string;
  officialUrl: string;
  cardPresets: string[];
  sortOrder: number;
}

export interface Category {
  id: CategoryId;
  nameUk: string;
  iconName: string;
  mccCodes: number[];
  keywords: string[];
  isUniversal?: boolean;
  sortOrder: number;
}

export interface Merchant {
  id: string;
  slug: string;
  nameUk: string;
  categoryId: CategoryId;
  secondaryCategoryId?: CategoryId;
  defaultMcc: number;
  searchAliases: string[];
  notesUk?: string;
  isVerified: boolean;
}

export interface UserCard {
  id: string;
  userId: string;
  bankId: BankId;
  cardName: string;
  taxPercent: number;
  isActive: boolean;
  createdAt: string;
}

export interface CashbackRule {
  id: string;
  cardId: string;
  userId: string;
  monthYear: string;
  ruleType: RuleType;
  categoryId?: CategoryId;
  merchantId?: string;
  customPartnerName?: string;
  rateOwnFunds: number;
  rateCreditFunds: number;
  updatedAt: string;
}

export interface PurchaseQuery {
  query: string;
  amountUah?: number;
  taxMode: TaxMode;
  selectedCategoryId?: CategoryId;
  selectedMerchantId?: string;
}

export interface FundOptionResult {
  ratePercent: number;
  grossCashbackUah: number;
  netCashbackUah: number;
  displayedCashbackUah: number;
  matchedRuleTitle: string | null;
  matchedRuleType: RuleType | null;
}

export interface PaymentRecommendation {
  card: UserCard;
  bank: Bank;
  matchedBy: 'MERCHANT_PARTNER' | 'CATEGORY_MCC' | 'ALL_PURCHASES_BASE' | 'NONE';
  matchedTitle: string;
  ownFunds: FundOptionResult;
  creditFunds: FundOptionResult;
  bestFundType: 'OWN' | 'CREDIT' | 'EQUAL' | 'NONE';
  bestRatePercent: number;
  bestGrossCashbackUah: number;
  bestNetCashbackUah: number;
  bestDisplayedCashbackUah: number;
}

export interface QueryResolutionResult {
  matchedMerchant: Merchant | null;
  matchedCategory: Category | null;
  secondaryCategory: Category | null;
  matchedMcc: number | null;
  suggestions: Array<{
    type: 'MERCHANT' | 'CATEGORY';
    id: string;
    label: string;
    sublabel: string;
    categoryId: CategoryId;
    mcc?: number;
  }>;
}

export type SuggestionType = 'NEW_MERCHANT' | 'FIX_MCC_CATEGORY' | 'BANK_UPDATE' | 'OTHER';
export type SuggestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ChangeSuggestion {
  id: string;
  userId: string;
  userEmail: string;
  suggestionType: SuggestionType;
  targetName: string;
  proposedCategoryId?: CategoryId;
  proposedMcc?: number;
  details: string;
  status: SuggestionStatus;
  createdAt: string;
}

export interface ParticipantUser {
  id: string;
  email: string;
  displayName: string;
  preferredTaxMode: TaxMode;
  isDemo?: boolean;
  createdAt: string;
}
