"""add_tournament_system_fields

Revision ID: b202610150001
Revises: ec6063b83113
Create Date: 2026-10-15 20:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b202610150001'
down_revision: Union[str, Sequence[str], None] = 'ec6063b83113'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add entry_fee_per_player and require_complete_teams to tournaments table."""
    op.add_column(
        'tournaments',
        sa.Column('entry_fee_per_player', sa.Integer(), server_default='0', nullable=False),
    )
    op.add_column(
        'tournaments',
        sa.Column('require_complete_teams', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    )


def downgrade() -> None:
    """Remove entry_fee_per_player and require_complete_teams from tournaments table."""
    op.drop_column('tournaments', 'require_complete_teams')
    op.drop_column('tournaments', 'entry_fee_per_player')
