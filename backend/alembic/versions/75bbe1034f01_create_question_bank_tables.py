"""create_question_bank_tables

Revision ID: 75bbe1034f01
Revises: 2ff49b90f2c8
Create Date: 2026-09-16 16:57:13.420071

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '75bbe1034f01'
down_revision: Union[str, Sequence[str], None] = '2ff49b90f2c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create questions table
    op.create_table(
        'questions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('question_type', sa.Enum('MULTIPLE_CHOICE_SINGLE', name='questiontype', native_enum=False), nullable=False),
        sa.Column('difficulty', sa.Enum('EASY', 'MEDIUM', 'HARD', name='questiondifficulty', native_enum=False), nullable=False),
        sa.Column('status', sa.Enum('DRAFT', 'REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED', name='questionstatus', native_enum=False), nullable=False),
        sa.Column('source', sa.Enum('MANUAL', 'WORD_IMPORT', 'AI_GENERATED', name='questionsource', native_enum=False), nullable=False),
        sa.Column('subject', sa.String(length=100), nullable=False),
        sa.Column('grade', sa.Integer(), nullable=False),
        sa.Column('chapter', sa.String(length=255), nullable=True),
        sa.Column('lesson', sa.String(length=255), nullable=True),
        sa.Column('topic', sa.String(length=255), nullable=True),
        sa.Column('learning_objective', sa.Text(), nullable=True),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.Column('knowledge_node_id', sa.Integer(), nullable=True),
        sa.Column('document_id', sa.Integer(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['knowledge_node_id'], ['knowledge_nodes.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_questions_id'), 'questions', ['id'], unique=False)
    op.create_index(op.f('ix_questions_subject'), 'questions', ['subject'], unique=False)
    op.create_index(op.f('ix_questions_grade'), 'questions', ['grade'], unique=False)
    op.create_index(op.f('ix_questions_status'), 'questions', ['status'], unique=False)
    op.create_index(op.f('ix_questions_difficulty'), 'questions', ['difficulty'], unique=False)
    op.create_index('ix_questions_subject_grade_status', 'questions', ['subject', 'grade', 'status'], unique=False)

    # 2. Create question_options table
    op.create_table(
        'question_options',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('question_id', sa.Integer(), nullable=False),
        sa.Column('option_key', sa.String(length=10), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('is_correct', sa.Boolean(), nullable=False),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_question_options_id'), 'question_options', ['id'], unique=False)
    op.create_index(op.f('ix_question_options_question_id'), 'question_options', ['question_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_question_options_question_id'), table_name='question_options')
    op.drop_index(op.f('ix_question_options_id'), table_name='question_options')
    op.drop_table('question_options')

    op.drop_index('ix_questions_subject_grade_status', table_name='questions')
    op.drop_index(op.f('ix_questions_difficulty'), table_name='questions')
    op.drop_index(op.f('ix_questions_status'), table_name='questions')
    op.drop_index(op.f('ix_questions_grade'), table_name='questions')
    op.drop_index(op.f('ix_questions_subject'), table_name='questions')
    op.drop_index(op.f('ix_questions_id'), table_name='questions')
    op.drop_table('questions')
