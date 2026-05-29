from typing import Dict, Any

# Package configurations: package_name -> {tokens, price_cop}
PACKAGES: Dict[str, Dict[str, Any]] = {
    "basico": {
        "tokens": 10,
        "price_cop": 10000
    },
    "estandar": {
        "tokens": 50,
        "price_cop": 45000
    },
    "premium": {
        "tokens": 120,
        "price_cop": 100000
    }
}

def get_package_info(package_name: str) -> Dict[str, Any]:
    """Retrieve fixed token package info from backend."""
    return PACKAGES.get(package_name.lower())

def process_simulated_payment(last_four: str, package_name: str) -> Dict[str, Any]:
    """
    Simulate the payment gateway result based on the last four digits of the test cards.
    Test cards mappings:
    - '1111' -> Aprobado
    - '0004' -> Aprobado
    - '0002' -> Rechazada (fondos_insuficientes)
    - '0069' -> Rechazada (tarjeta_vencida)
    - Any other -> Rechazada (otro)
    """
    package = get_package_info(package_name)
    if not package:
        return {
            "success": False,
            "rejection_reason": "otro",
            "message": "Paquete inválido"
        }
        
    if last_four == "1111" or last_four == "0004":
        return {
            "success": True,
            "tokens_amount": package["tokens"],
            "price_cop": package["price_cop"],
            "message": "Pago aprobado exitosamente"
        }
    elif last_four == "0002":
        return {
            "success": False,
            "rejection_reason": "fondos_insuficientes",
            "message": "Transacción rechazada: fondos insuficientes"
        }
    elif last_four == "0069":
        return {
            "success": False,
            "rejection_reason": "tarjeta_vencida",
            "message": "Transacción rechazada: tarjeta vencida o bloqueada"
        }
    else:
        return {
            "success": False,
            "rejection_reason": "otro",
            "message": "Transacción rechazada por el banco emisor"
        }
