const integer = (value, fallback) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const CREDIT_PACKAGES = [
    { id: "starter", name: "Starter", credits: integer(process.env.CREDIT_PACKAGE_STARTER_CREDITS, 100), amount: integer(process.env.CREDIT_PACKAGE_STARTER_AMOUNT, 9900) },
    { id: "basic", name: "Basic", credits: integer(process.env.CREDIT_PACKAGE_BASIC_CREDITS, 300), amount: integer(process.env.CREDIT_PACKAGE_BASIC_AMOUNT, 24900) },
    { id: "pro", name: "Pro", credits: integer(process.env.CREDIT_PACKAGE_PRO_CREDITS, 700), amount: integer(process.env.CREDIT_PACKAGE_PRO_AMOUNT, 49900) },
    { id: "premium", name: "Premium", credits: integer(process.env.CREDIT_PACKAGE_PREMIUM_CREDITS, 1500), amount: integer(process.env.CREDIT_PACKAGE_PREMIUM_AMOUNT, 89900) },
];

export const getCreditPackage = (id) => CREDIT_PACKAGES.find((item) => item.id === id);
