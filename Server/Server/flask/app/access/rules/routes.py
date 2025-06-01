# app/rules/routes.py
import logging
import uuid
from decimal import Decimal
from flask import Blueprint, jsonify, request, abort, current_app
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from app.json_schemas import actionParams_schema
from app.dep_lib import allowed_rules_init

# Import the blueprint object defined in __init__.py
from . import rules_bp

# Import the request-scoped session factory
from app import DbRequestSession

# Import necessary models
from app.db_man.pqsql.models import (
    Rule, RuleSet, RuleInitiator, RuleAction, Tag, Group, group_rules
)

# Import cache invalidation functions (optional, but good practice)
# We need to invalidate group caches if rules/rulesets they use are modified/deleted
# Ensure this path is correct for your project structure
try:
    from app.cache.database_caching import invalidate_group_rules_cache
except ImportError:
    logging.warning("Cache invalidation function 'invalidate_group_rules_cache' not found. Skipping cache invalidation.")
    # Define a dummy function if not found, so the code doesn't break
    def invalidate_group_rules_cache(*args, **kwargs):
        pass


from flask_jwt_extended import jwt_required #, get_jwt_identity # get_jwt_identity is unused currently
from jsonschema import validate, ValidationError


from app.helpers.formatters import _generate_id, _format_rule_detail, _format_ruleset_detail, _format_tag_for_rule_frontend, _format_group_for_rule_frontend


# --- Rule CRUD Routes ---

# Remember to register blueprint with url_prefix='/access/rules'
@rules_bp.route('/rules', methods=['GET'])
@jwt_required()
def list_rules():
    """Lists all rules with detailed information."""
    logging.info("GET /rules requested")
    db: Session = DbRequestSession()
    try:
        rules_orm = db.query(Rule).options(
            selectinload(Rule.initiators).selectinload(RuleInitiator.tags),
            selectinload(Rule.actions),

        ).order_by(Rule.name).all()

        rules_list = [_format_rule_detail(rule) for rule in rules_orm]
        logging.info(f"Returning {len(rules_list)} rules.")
        # **CORRECTED Response Structure**
        return jsonify({"rules": rules_list})
    except SQLAlchemyError as e:
        logging.error(f"Database error listing rules: {e}", exc_info=True)
        abort(500, description="Failed to retrieve rules.")
    except Exception as e:
        logging.error(f"Unexpected error listing rules: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while listing rules.")


@rules_bp.route('/rules/<string:rule_id>', methods=['GET'])
@jwt_required()
def get_rule(rule_id: str):
    """Gets details for a specific rule."""
    logging.info(f"GET /rules/{rule_id} requested")
    db: Session = DbRequestSession()
    try:
        rule = db.query(Rule).options(
            selectinload(Rule.initiators).selectinload(RuleInitiator.tags),
            selectinload(Rule.actions),
        ).filter(Rule.id == rule_id).one_or_none()

        if not rule:
            abort(404, description=f"Rule with ID '{rule_id}' not found.")

        formatted_rule = _format_rule_detail(rule)
        # **CORRECTED Response Structure**
        return jsonify({"rule": formatted_rule})
    except SQLAlchemyError as e:
        logging.error(f"Database error getting rule '{rule_id}': {e}", exc_info=True)
        abort(500, description="Failed to retrieve rule details.")
    except Exception as e:
        logging.error(f"Unexpected error getting rule '{rule_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred retrieving rule details.")


@rules_bp.route('/rules', methods=['POST'])
@jwt_required()
def create_rule():
    """Creates a new rule."""
    logging.info("POST /rules requested")
    db: Session = DbRequestSession()
    data = request.get_json()

    if not data: abort(400, description="Request body is missing or not JSON.")
    if not data.get('name'): abort(400, description="Missing required field: 'name'.")
    if not data.get('initiators'): abort(400, description="Missing required field: 'initiators'.")
    if not data.get('action'): abort(400, description="Missing required field: 'action'.")
    try: 
         validate(instance=data.get('actionParams'), schema=actionParams_schema)
    except ValidationError as e:
        logging.warning(f"Validation of the actions was NOT succesfull: {e}")
        abort(400, desciption="Action Validation Failed")

    new_rule_id = _generate_id("rule")

    try:
        # --- Create Initiators ---
        initiators_orm = []
        for init_data in data.get('initiators', []):
            initiator_tags = []
            if init_data.get('tags'):
                # Ensure tags exist before associating
                tag_ids = init_data['tags']
                found_tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
                if len(found_tags) != len(tag_ids):
                     missing_ids = set(tag_ids) - {t.id for t in found_tags}
                     abort(404, description=f"Initiator tags not found: {', '.join(missing_ids)}")
                initiator_tags = found_tags
            if not init_data.get('type', 'none') in allowed_rules_init:
                logging.error(f"{init_data.get('type', 'none')} is not in allowed rules init")
                abort(400, "type is not allowed")
            initiator = RuleInitiator(
                initiator_ref_id=init_data.get('ref_id'),
                type=init_data['type'],
                operator=init_data.get('operator'),
                # Use Decimal for precision in DB if needed, convert here
                value=Decimal(str(init_data['value'])) if init_data.get('value') is not None else None,
                value2=Decimal(str(init_data['value2'])) if init_data.get('value2') is not None else None,
                schedule_type=init_data.get('scheduleType'),
                schedule_value=init_data.get('scheduleValue'),
                tags=initiator_tags
            )
            initiators_orm.append(initiator)

        # --- Create Actions (Assuming one from frontend) ---
        actions_orm = []
        action_type = data.get('action')
        action_params = data.get('actionParams')
        logging.debug(f"Action params: {action_params}")
        if action_type:
             action = RuleAction(
                 action_type=action_type,
                 action_params=action_params or {},
                 execution_order=0
             )
             actions_orm.append(action)
        # --- Handle RuleSet assignment ---
        rule_set_id = data.get('ruleSet')
        if rule_set_id == 'none' or not rule_set_id:
            rule_set_id = None
        elif rule_set_id:
             if not db.query(RuleSet.id).filter(RuleSet.id == rule_set_id).scalar():
                  abort(404, description=f"RuleSet with ID '{rule_set_id}' not found.")

        # --- Create Rule ---
        new_rule = Rule(
            id=new_rule_id,
            name=data['name'],
            description=data.get('description'),
            logical_operator=data.get('logicalOperator', 'and'),
            is_active=data.get('isActive', True),
            rule_set_id=rule_set_id,
            priority=data.get('priority', 5),
            initiators=initiators_orm,
            actions=actions_orm
        )

        db.add(new_rule)
        db.commit()

        # --- Invalidate Cache ---
        if rule_set_id:
             ruleset = db.query(RuleSet).options(selectinload(RuleSet.groups)).get(rule_set_id)
             if ruleset and hasattr(ruleset, 'groups'):
                  rc = current_app.redis_client
                  for group in ruleset.groups:
                       invalidate_group_rules_cache(rc, group.id)
        else:
            logging.debug(f"Rule set id: {rule_set_id}")
        # Fetch the created rule with all relations for the response
        # Use get() which is slightly more efficient for primary key lookup after commit
        created_rule = db.query(Rule).options(
            selectinload(Rule.initiators).selectinload(RuleInitiator.tags),
            selectinload(Rule.actions),
        ).get(new_rule_id)

        if not created_rule: # Should not happen, but safety check
             logging.error(f"Failed to fetch created rule {new_rule_id} after commit.")
             abort(500, description="Failed to retrieve created rule.")

        logging.info(f"Successfully created rule ID: {new_rule_id}")
        # **CORRECTED Response Structure**
        return jsonify({"rule": _format_rule_detail(created_rule)}), 201

    except IntegrityError as e:
        db.rollback()
        logging.error(f"Database integrity error creating rule: {e}", exc_info=True)
        abort(409, description="Could not create rule. Conflict with existing data.")
    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error creating rule: {e}", exc_info=True)
        abort(500, description="Failed to create rule due to database error.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error creating rule: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while creating the rule.")


@rules_bp.route('/rules/<string:rule_id>', methods=['PUT'])
@jwt_required()
def update_rule(rule_id: str):
    """Updates an existing rule."""
    logging.info(f"PUT /rules/{rule_id} requested")
    db: Session = DbRequestSession()
    rc = current_app.redis_client
    data = request.get_json()

    if not data: abort(400, description="Request body is missing or not JSON.")
    try: 
         validate(instance=data.get('actionParams'), schema=actionParams_schema)
    except ValidationError as e:
        logging.warning(f"Validation of the actions was NOT succesfull: {e}")
        abort(400, description="Action Validation Failed") # Corrected 'desciption' to 'description'
        
    try:
        # Fetch the rule as it exists BEFORE any updates
        rule = db.query(Rule).filter(Rule.id == rule_id).one_or_none()

        if not rule:
            abort(404, description=f"Rule with ID '{rule_id}' not found.")

        # --- Store original context for cache invalidation ---
        original_affected_group_ids = set()
        original_ruleset_fk_id = rule.rule_set_id

        # 1a. Groups from the original RuleSet
        if original_ruleset_fk_id:
             original_ruleset_obj = db.query(RuleSet).options(selectinload(RuleSet.groups)).get(original_ruleset_fk_id)
             if original_ruleset_obj and original_ruleset_obj.groups: 
                 original_affected_group_ids.update(g.id for g in original_ruleset_obj.groups)
        
        # 1b. Groups to which the rule was originally directly applied (querying association table)
        # from app.db_man.pqsql.models import group_rules # Ensure group_rules is imported
        original_direct_links = db.query(Group.id).join(group_rules).filter(group_rules.c.rule_id == rule_id).all()
        for group_id_tuple in original_direct_links:
            original_affected_group_ids.add(group_id_tuple[0]) # group_id_tuple is (id,)
      
        # --- Update Basic Fields ---
        if 'name' in data: rule.name = data['name']
        if 'description' in data: rule.description = data['description']
        if 'logicalOperator' in data: rule.logical_operator = data['logicalOperator']
        if 'isActive' in data: rule.is_active = data['isActive']
        if 'priority' in data: rule.priority = data['priority']
       
        # --- Update Initiators (Replace Strategy) --- 
        logging.debug("Updating Initiators") # Corrected "Intitiators"
        if 'initiators' in data:
            db.query(RuleInitiator).filter(RuleInitiator.rule_id == rule.id).delete(synchronize_session=False)
            db.flush() # Ensure deletes are processed before adds if there are unique constraints or other dependencies
            
            new_initiators_orm = []
            for init_data in data['initiators']:
                # ... (your existing initiator creation logic)
                initiator_tags_orm = []
                if init_data.get('tags'):
                    tag_ids = init_data['tags']
                    found_tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
                    if len(found_tags) != len(tag_ids):
                         missing_ids = set(tag_ids) - {t.id for t in found_tags}
                         abort(404, description=f"Initiator tags not found: {', '.join(missing_ids)}")
                    initiator_tags_orm = found_tags
                
                initiator = RuleInitiator(
                    rule_id=rule.id, 
                    initiator_ref_id=init_data.get('ref_id'),
                    type=init_data['type'],
                    operator=init_data.get('operator'),
                    value=Decimal(str(init_data['value'])) if init_data.get('value') is not None else None,
                    value2=Decimal(str(init_data['value2'])) if init_data.get('value2') is not None else None,
                    schedule_type=init_data.get('scheduleType'),
                    schedule_value=init_data.get('scheduleValue'),
                    tags=initiator_tags_orm # Use the fetched Tag objects
                )
                new_initiators_orm.append(initiator)
            rule.initiators = new_initiators_orm # Assign the new list

        # --- Update Actions (Replace Strategy) ---
        if 'action' in data or 'actionParams' in data:
            db.query(RuleAction).filter(RuleAction.rule_id == rule.id).delete(synchronize_session=False)
            db.flush() # Ensure deletes are processed

            new_actions_orm = []
            # Determine action_type: use from data if present, else try to keep original, else None
            current_action_type = rule.actions[0].action_type if rule.actions else None
            action_type = data.get('action', current_action_type)
            
            # Determine action_params: use from data if present, else try to keep original, else {}
            current_action_params = rule.actions[0].action_params if rule.actions else {}
            action_params = data.get('actionParams', current_action_params)

            if action_type: # Only create action if type is defined
                 action = RuleAction(
                     rule_id=rule.id,
                     action_type=action_type,
                     action_params=action_params or {},
                     execution_order=0
                 )
                 new_actions_orm.append(action)
            rule.actions = new_actions_orm # Assign the new list

        # --- Update RuleSet assignment ---
        if 'ruleSet' in data:
            new_rule_set_id = data.get('ruleSet')
            if new_rule_set_id == 'none' or not new_rule_set_id: # Handles empty string or "none"
                rule.rule_set_id = None
            elif new_rule_set_id: # If it's a non-empty string
                if not db.query(RuleSet.id).filter(RuleSet.id == new_rule_set_id).scalar():
                     abort(404, description=f"RuleSet with ID '{new_rule_set_id}' not found.")
                rule.rule_set_id = new_rule_set_id
            # If 'ruleSet' key exists but value is null (already handled by first condition) or an empty string (handled by first condition)

        logging.debug("Starting commit for rule update!")
        db.commit()
        logging.debug("Commit finished for rule update!")

        # --- Invalidate Cache ---
        # Rule properties or its RuleSet might have changed.
        # Directly associated groups (via group_rules) also need cache invalidation
        # even if the set of directly associated groups itself didn't change, because the rule content changed.
        
        current_affected_group_ids = set()
        # 2a. Groups from the new/current RuleSet (rule.rule_set_id now reflects the committed value)
        if rule.rule_set_id:
             current_ruleset_obj = db.query(RuleSet).options(selectinload(RuleSet.groups)).get(rule.rule_set_id)
             if current_ruleset_obj and current_ruleset_obj.groups:
                 current_affected_group_ids.update(g.id for g in current_ruleset_obj.groups)

        # 2b. Groups to which the rule is currently directly applied (querying association table again)
        # This list of groups may or may not have changed, but the rule they use HAS changed.
        current_direct_links = db.query(Group.id).join(group_rules).filter(group_rules.c.rule_id == rule_id).all()
        for group_id_tuple in current_direct_links:
            current_affected_group_ids.add(group_id_tuple[0])

        # Combine all group IDs that were affected before OR are affected now
        all_group_ids_to_invalidate = original_affected_group_ids.union(current_affected_group_ids)
        
        if all_group_ids_to_invalidate:
            logging.info(f"Invalidating cache for groups: {all_group_ids_to_invalidate} due to rule update {rule_id}")
            for group_id_to_invalidate in all_group_ids_to_invalidate:
                 invalidate_group_rules_cache(rc, group_id_to_invalidate)
        else:
            logging.debug(f"Rule {rule_id} updated. No specific group caches to invalidate based on its RuleSet or direct associations.")

        # Fetch the updated rule with relations freshly loaded for the response
        updated_rule_for_response = db.query(Rule).options(
            selectinload(Rule.initiators).selectinload(RuleInitiator.tags),
            selectinload(Rule.actions),
        ).get(rule_id) 

        if not updated_rule_for_response:
             logging.error(f"Failed to fetch updated rule {rule_id} after commit.")
             abort(500, description="Failed to retrieve updated rule.")

        logging.info(f"Successfully updated rule ID: {rule_id}")
        return jsonify({"rule": _format_rule_detail(updated_rule_for_response)})

    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error updating rule '{rule_id}': {e}", exc_info=True)
        abort(500, description="Failed to update rule due to database error.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error updating rule '{rule_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while updating the rule.")


@rules_bp.route('/rules/<string:rule_id>', methods=['DELETE'])
@jwt_required()
def delete_rule(rule_id: str):
    """Deletes a rule."""
    logging.info(f"DELETE /rules/{rule_id} requested")
    db: Session = DbRequestSession()
    rc = current_app.redis_client

    try:
        # Load rule and potentially affected groups for cache invalidation BEFORE delete
        rule = db.query(Rule).options(
             selectinload(Rule.rule_sets).selectinload(RuleSet.groups),
             # selectinload(Rule.applies_to_tags) # Might need reverse lookup for tagged groups
        ).filter(Rule.id == rule_id).one_or_none()

        if not rule:
            # Return 204 even if not found, as DELETE is idempotent
            logging.warning(f"Rule ID {rule_id} not found for deletion.")
            return '', 204

        # --- Invalidate Cache ---
        affected_group_ids = set()
        if rule.rule_set_id:
             ruleset = db.query(RuleSet).options(selectinload(RuleSet.groups)).get(rule.rule_set_id)
             if ruleset: affected_group_ids.update(g.id for g in ruleset.groups)
       
        for group_id_to_invalidate in affected_group_ids:
             invalidate_group_rules_cache(rc, group_id_to_invalidate)

        # --- Delete Rule ---
        # Related Initiators/Actions should cascade delete if configured in DB/Model
        db.delete(rule)
        db.commit()

        logging.info(f"Successfully deleted rule ID: {rule_id}")
        # **CORRECTED Response:** Return 204 No Content
        return '', 204

    except IntegrityError as e:
        db.rollback()
        # This might happen if DB constraints prevent deletion (e.g., FKs without cascade)
        logging.error(f"Database integrity error deleting rule '{rule_id}': {e}", exc_info=True)
        abort(409, description="Cannot delete rule. It might be referenced elsewhere.")
    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error deleting rule '{rule_id}': {e}", exc_info=True)
        abort(500, description="Failed to delete rule due to database error.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error deleting rule '{rule_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while deleting the rule.")


# --- RuleSet CRUD Routes ---

@rules_bp.route('/rule_sets', methods=['GET'])
@jwt_required()
def list_rule_sets():
    """Lists all rule sets."""
    logging.info("GET /rule_sets requested")
    db: Session = DbRequestSession()
    try:
        rulesets_orm = db.query(RuleSet).options(
            selectinload(RuleSet.rules) # Load rules to get IDs
        ).order_by(RuleSet.name).all()

        rulesets_list = [_format_ruleset_detail(rs) for rs in rulesets_orm]
        logging.info(f"Returning {len(rulesets_list)} rule sets.")
         # **CORRECTED Response Structure**
        return jsonify({"rule_sets": rulesets_list})
    except SQLAlchemyError as e:
        logging.error(f"Database error listing rule sets: {e}", exc_info=True)
        abort(500, description="Failed to retrieve rule sets.")
    except Exception as e:
        logging.error(f"Unexpected error listing rule sets: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while listing rule sets.")


@rules_bp.route('/rule_sets/<string:ruleset_id>', methods=['GET'])
@jwt_required()
def get_rule_set(ruleset_id: str):
    """Gets details for a specific rule set."""
    logging.info(f"GET /rule_sets/{ruleset_id} requested")
    db: Session = DbRequestSession()
    try:
        ruleset = db.query(RuleSet).options(
            selectinload(RuleSet.rules)
        ).filter(RuleSet.id == ruleset_id).one_or_none()

        if not ruleset:
            abort(404, description=f"RuleSet with ID '{ruleset_id}' not found.")

        # **CORRECTED Response Structure**
        return jsonify({"rule_set": _format_ruleset_detail(ruleset)})
    except SQLAlchemyError as e:
        logging.error(f"Database error getting rule set '{ruleset_id}': {e}", exc_info=True)
        abort(500, description="Failed to retrieve rule set details.")
    except Exception as e:
        logging.error(f"Unexpected error getting rule set '{ruleset_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred retrieving rule set details.")


@rules_bp.route('/rule_sets', methods=['POST'])
@jwt_required()
def create_rule_set():
    """Creates a new rule set."""
    logging.info("POST /rule_sets requested")
    db: Session = DbRequestSession()
    data = request.get_json()

    if not data: abort(400, description="Request body is missing or not JSON.")
    if not data.get('name'): abort(400, description="Missing required field: 'name'.")

    new_ruleset_id = _generate_id("ruleset")

    try:
        # Fetch Rule objects to assign (using rule_set_id FK now)
        # We don't assign rules directly here; rules get assigned via their rule_set_id
        rules_to_assign = []
        rule_ids = data.get('rules', []) # FE sends rule IDs it wants in the set
        if rule_ids:
             # Verify rules exist
             found_rules = db.query(Rule).filter(Rule.id.in_(rule_ids)).all()
             if len(found_rules) != len(rule_ids):
                  missing_ids = set(rule_ids) - {r.id for r in found_rules}
                  abort(404, description=f"Rules to add to set not found: {', '.join(missing_ids)}")
             rules_to_assign = found_rules


        new_ruleset = RuleSet(
            id=new_ruleset_id,
            name=data['name'],
            description=data.get('description'),
            is_active=data.get('isActive', True),
            # Don't assign rules via relationship here if using rule_set_id FK
        )
        db.add(new_ruleset)
        # We need the ID before assigning it to rules
        db.flush() # Flush to get the ID assigned if not already

        # Now update the rules to point to this new RuleSet
        if rules_to_assign:
            for rule in rules_to_assign:
                rule.rule_set_id = new_ruleset.id

        db.commit()

        # --- Cache Invalidation (Potentially complex) ---
        # Invalidate cache for groups affected by the rules added to this new set
        rc = current_app.redis_client
        affected_group_ids = set()
     
        # Fetch the created ruleset with relations for the response
        created_ruleset = db.query(RuleSet).options(
            selectinload(RuleSet.rules) # Load rules now associated via FK
        ).get(new_ruleset_id)

        if not created_ruleset:
             logging.error(f"Failed to fetch created ruleset {new_ruleset_id} after commit.")
             abort(500, description="Failed to retrieve created ruleset.")

        logging.info(f"Successfully created ruleset ID: {new_ruleset_id}")
        # **CORRECTED Response Structure**
        return jsonify({"rule_set": _format_ruleset_detail(created_ruleset)}), 201

    except IntegrityError as e:
        db.rollback()
        logging.error(f"Database integrity error creating ruleset: {e}", exc_info=True)
        abort(409, description="Could not create ruleset. Conflict with existing data.")
    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error creating ruleset: {e}", exc_info=True)
        abort(500, description="Failed to create ruleset due to database error.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error creating ruleset: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while creating the ruleset.")


@rules_bp.route('/rule_sets/<string:ruleset_id>', methods=['PUT'])
@jwt_required()
def update_rule_set(ruleset_id: str):
    """Updates an existing rule set."""
    logging.info(f"PUT /rule_sets/{ruleset_id} requested")
    db: Session = DbRequestSession()
    rc = current_app.redis_client
    data = request.get_json()

    if not data: abort(400, description="Request body is missing or not JSON.")

    try:
        ruleset = db.query(RuleSet).options(
            selectinload(RuleSet.rules),
            selectinload(RuleSet.groups) # Load groups for cache invalidation
        ).filter(RuleSet.id == ruleset_id).one_or_none()

        if not ruleset:
            abort(404, description=f"RuleSet with ID '{ruleset_id}' not found.")

        original_group_ids = {g.id for g in ruleset.groups}
        original_rule_ids = {r.id for r in ruleset.rules}
        rules_changed = False
        status_changed = False

        # --- Update Basic Fields ---
        if 'name' in data: ruleset.name = data['name']
        if 'description' in data: ruleset.description = data['description']
        if 'isActive' in data and ruleset.is_active != data['isActive']:
             ruleset.is_active = data['isActive']
             status_changed = True

        # --- Update Rules (Update rule.rule_set_id) ---
        if 'rules' in data:
            new_rule_ids = set(data.get('rules', []))
            if original_rule_ids != new_rule_ids:
                rules_changed = True
                # Rules to remove from this set
                rules_to_remove_ids = original_rule_ids - new_rule_ids
                if rules_to_remove_ids:
                    db.query(Rule).filter(
                        Rule.id.in_(rules_to_remove_ids),
                        Rule.rule_set_id == ruleset_id # Ensure we only affect rules currently in *this* set
                    ).update({"rule_set_id": None}, synchronize_session=False)

                # Rules to add to this set
                rules_to_add_ids = new_rule_ids - original_rule_ids
                if rules_to_add_ids:
                     # Verify rules exist before adding
                     found_rules = db.query(Rule.id).filter(Rule.id.in_(rules_to_add_ids)).all()
                     if len(found_rules) != len(rules_to_add_ids):
                          found_ids = {r[0] for r in found_rules}
                          missing_ids = rules_to_add_ids - found_ids
                          abort(404, description=f"Rules to add to set not found: {', '.join(missing_ids)}")

                     db.query(Rule).filter(Rule.id.in_(rules_to_add_ids)).update(
                         {"rule_set_id": ruleset_id}, synchronize_session=False
                     )

        db.commit()

        # --- Invalidate Cache ---
        if rules_changed or status_changed:
             # Invalidate original groups AND groups potentially affected by newly added/removed rules
             new_rule_ids = set(data.get('rules', [])) if 'rules' in data else original_rule_ids
             all_possibly_affected_rule_ids = original_rule_ids.union(new_rule_ids)

             # This is still complex. Simpler: invalidate all groups associated with the ruleset before/after.
             current_groups = db.query(Group).join(RuleSet.groups).filter(RuleSet.id == ruleset_id).all()
             all_affected_group_ids = original_group_ids.union({g.id for g in current_groups})

             for group_id in all_affected_group_ids:
                  invalidate_group_rules_cache(rc, group_id)


        # Fetch the updated ruleset fresh after commit
        updated_ruleset = db.query(RuleSet).options(
            selectinload(RuleSet.rules)
        ).get(ruleset_id)

        if not updated_ruleset:
             logging.error(f"Failed to fetch updated ruleset {ruleset_id} after commit.")
             abort(500, description="Failed to retrieve updated ruleset.")


        logging.info(f"Successfully updated ruleset ID: {ruleset_id}")
        # **CORRECTED Response Structure**
        return jsonify({"rule_set": _format_ruleset_detail(updated_ruleset)})

    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error updating ruleset '{ruleset_id}': {e}", exc_info=True)
        abort(500, description="Failed to update ruleset due to database error.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error updating ruleset '{ruleset_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while updating the ruleset.")


@rules_bp.route('/rule_sets/<string:ruleset_id>', methods=['DELETE'])
@jwt_required()
def delete_rule_set(ruleset_id: str):
    """Deletes a rule set and unassigns its rules."""
    logging.info(f"DELETE /rule_sets/{ruleset_id} requested")
    db: Session = DbRequestSession()
    rc = current_app.redis_client

    try:
        ruleset = db.query(RuleSet).options(
            selectinload(RuleSet.groups) # Load groups for cache invalidation
        ).filter(RuleSet.id == ruleset_id).one_or_none()

        if not ruleset:
            logging.warning(f"RuleSet ID {ruleset_id} not found for deletion.")
            return '', 204 # Idempotent

        # --- Invalidate Cache ---
        original_group_ids = {g.id for g in ruleset.groups}
        for group_id in original_group_ids:
            invalidate_group_rules_cache(rc, group_id)

        # --- Handle Rules previously in the set ---
        # Set rule.rule_set_id to None for rules currently in this set
        # Use synchronize_session=False for potentially better performance
        db.query(Rule).filter(Rule.rule_set_id == ruleset_id).update(
            {"rule_set_id": None}, synchronize_session=False
        )

        # --- Delete Ruleset ---
        db.delete(ruleset)
        db.commit()

        logging.info(f"Successfully deleted ruleset ID: {ruleset_id} and unassigned its rules.")
        # **CORRECTED Response:** Return 204 No Content
        return '', 204

    except IntegrityError as e:
        db.rollback()
        logging.error(f"Database integrity error deleting ruleset '{ruleset_id}': {e}", exc_info=True)
        abort(409, description="Cannot delete ruleset. Check for other references.")
    except SQLAlchemyError as e:
        db.rollback()
        logging.error(f"Database error deleting ruleset '{ruleset_id}': {e}", exc_info=True)
        abort(500, description="Failed to delete ruleset due to database error.")
    except Exception as e:
        db.rollback()
        logging.error(f"Unexpected error deleting ruleset '{ruleset_id}': {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while deleting the ruleset.")


# --- Routes for Related Data (Tags, Groups) ---

@rules_bp.route('/tags', methods=['GET'])
@jwt_required()
def list_tags_for_rules():
    """Lists all tags relevant for rule creation/editing."""
    logging.info("GET /tags for rules requested")
    db: Session = DbRequestSession()
    try:
        tags_orm = db.query(Tag).order_by(Tag.type, Tag.name).all()
        # Use the specific formatter for frontend compatibility
        tags_list = [_format_tag_for_rule_frontend(tag) for tag in tags_orm]
        logging.info(f"Returning {len(tags_list)} tags for rules.")
         # **CORRECTED Response Structure**
        return jsonify({"tags": tags_list})
    except SQLAlchemyError as e:
        logging.error(f"Database error listing tags for rules: {e}", exc_info=True)
        abort(500, description="Failed to retrieve tags.")
    except Exception as e:
        logging.error(f"Unexpected error listing tags for rules: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while listing tags.")


@rules_bp.route('/groups', methods=['GET'])
@jwt_required()
def list_groups_for_rules():
    """Lists all groups relevant for rule creation/editing."""
    logging.info("GET /groups for rules requested")
    db: Session = DbRequestSession()
    try:
        # Query only needed columns if performance is critical, but ORM objects are fine too
        # groups_orm = db.query(Group.id, Group.name).order_by(Group.name).all() # Query specific columns
        groups_orm = db.query(Group).order_by(Group.name).all() # Query full objects
        # Use the specific formatter
        groups_list = [_format_group_for_rule_frontend(group) for group in groups_orm]
        logging.info(f"Returning {len(groups_list)} groups for rules.")
         # **CORRECTED Response Structure**
        return jsonify({"groups": groups_list})
    except SQLAlchemyError as e:
        logging.error(f"Database error listing groups for rules: {e}", exc_info=True)
        abort(500, description="Failed to retrieve groups.")
    except Exception as e:
        logging.error(f"Unexpected error listing groups for rules: {e}", exc_info=True)
        abort(500, description="An unexpected error occurred while listing groups.")