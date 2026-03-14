from ..extensions import db
from ..models import Operation, Warehouse


def generate_reference(warehouse_code, op_type):
    """Generate reference like WH/IN/001"""
    type_map = {
        'receipt': 'IN',
        'delivery': 'OUT',
        'transfer': 'INT',
        'adjustment': 'ADJ'
    }
    prefix = f"{warehouse_code}/{type_map.get(op_type, 'OP')}"
    # Count existing with same prefix
    count = Operation.query.filter(Operation.reference.like(f'{prefix}/%')).count()
    return f"{prefix}/{str(count + 1).zfill(4)}"
