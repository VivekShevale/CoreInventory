# server/app/ml/categorizer.py
# ─────────────────────────────────────────────────────────────────────────────
# Product Auto-Categoriser — Multinomial Naive Bayes from scratch.
#
# When a user creates a new product, this model predicts the most likely
# category based on the product name and SKU, and suggests it in the UI.
#
# Training: uses all existing products in the DB as labelled examples.
# Prediction: returns top-3 category candidates with confidence scores.
#
# Algorithm: Multinomial Naive Bayes with Laplace (add-1) smoothing.
# Zero external ML deps — pure Python + numpy.
# ─────────────────────────────────────────────────────────────────────────────

import re
import numpy as np
from collections import defaultdict


def _tokenise(text: str):
    text = text.lower()
    text = re.sub(r'[^\w\s]', ' ', text)
    tokens = text.split()
    # Add character bigrams for short tokens (handles SKU codes like DESK001)
    extras = []
    for tok in tokens:
        if len(tok) >= 4:
            extras += [tok[i:i+3] for i in range(len(tok)-2)]
    return tokens + extras


class NaiveBayesCategorizer:
    """
    Multinomial Naive Bayes text classifier.
    Trained on product name + SKU → category label.
    """

    def __init__(self, alpha: float = 1.0):
        self.alpha      = alpha          # Laplace smoothing
        self.classes_   = []             # list of category names
        self.log_priors = {}             # log P(class)
        self.log_likes  = {}             # log P(token | class)
        self.vocab      = {}             # token → index
        self.fitted     = False

    def fit(self, texts, labels):
        """
        texts  — list of str (product name + sku)
        labels — list of str (category name)
        """
        if len(texts) < 2:
            return self

        self.classes_ = list(set(labels))
        n_total       = len(texts)

        # Build vocabulary
        all_tokens = set()
        tokenised  = []
        for text in texts:
            toks = _tokenise(text)
            tokenised.append(toks)
            all_tokens.update(toks)

        self.vocab = {t: i for i, t in enumerate(sorted(all_tokens))}
        V = len(self.vocab)

        # Count token frequencies per class
        class_counts  = defaultdict(lambda: np.zeros(V))
        class_totals  = defaultdict(int)
        class_doc_cnt = defaultdict(int)

        for toks, label in zip(tokenised, labels):
            class_doc_cnt[label] += 1
            for tok in toks:
                if tok in self.vocab:
                    class_counts[label][self.vocab[tok]] += 1
                    class_totals[label] += 1

        # Log priors
        self.log_priors = {
            c: np.log(class_doc_cnt[c] / n_total)
            for c in self.classes_
        }

        # Log likelihoods with Laplace smoothing
        self.log_likes = {}
        for c in self.classes_:
            total = class_totals[c] + self.alpha * V
            self.log_likes[c] = np.log(
                (class_counts[c] + self.alpha) / total
            )

        self.fitted = True
        return self

    def predict_proba(self, text: str):
        """
        Returns list of (category, probability) sorted by probability desc.
        """
        if not self.fitted or not self.classes_:
            return []

        toks = _tokenise(text)
        V    = len(self.vocab)

        # Query vector
        q = np.zeros(V)
        for tok in toks:
            if tok in self.vocab:
                q[self.vocab[tok]] += 1

        # Log posterior per class
        log_scores = {}
        for c in self.classes_:
            log_scores[c] = self.log_priors[c] + float(self.log_likes[c] @ q)

        # Softmax to get probabilities
        max_log = max(log_scores.values())
        exp_scores = {c: np.exp(v - max_log) for c, v in log_scores.items()}
        total      = sum(exp_scores.values())
        probs      = {c: exp_scores[c] / total for c in self.classes_}

        return sorted(probs.items(), key=lambda x: -x[1])

    def predict(self, text: str):
        """Returns (best_category, confidence)."""
        proba = self.predict_proba(text)
        if not proba:
            return None, 0.0
        return proba[0]

    def top_k(self, text: str, k: int = 3):
        """Returns top-k (category, confidence) pairs."""
        return self.predict_proba(text)[:k]


# ── global model instance (rebuilt on demand) ──────────────────────────────────
_model_cache = {'model': None, 'n_products': 0}


def get_or_train_model(products):
    """
    Returns a trained categoriser.
    Re-trains if the product count has changed (i.e. new products added).
    """
    n = len(products)
    if _model_cache['model'] is None or _model_cache['n_products'] != n:
        texts  = [f"{p.name} {p.sku}" for p in products if p.category]
        labels = [p.category.name for p in products if p.category]
        model  = NaiveBayesCategorizer(alpha=1.0).fit(texts, labels)
        _model_cache['model']      = model
        _model_cache['n_products'] = n
    return _model_cache['model']


def suggest_category(name: str, sku: str, products) -> list:
    """
    Suggest top-3 categories for a new product.

    Returns list of { category, confidence, pct } dicts.
    """
    model = get_or_train_model(products)
    text  = f"{name} {sku}"
    tops  = model.top_k(text, k=3)
    return [
        {
            'category':   cat,
            'confidence': round(float(conf), 3),
            'pct':        round(float(conf) * 100, 1),
        }
        for cat, conf in tops
    ]