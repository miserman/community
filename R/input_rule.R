#' Add an input rule to a website
#'
#' Specifies if-then conditions for inputs; that is, when one input is changed, change another based on
#' the entered conditions.
#'
#' @param condition A string representing the condition (e.g., "input_a == 'a'"), with multiple conditions
#' separated by \code{"&"}. If all conditions are \code{TRUE}, all \code{effects} will be set.
#' @param effects A list with names corresponding to input IDs, and values of what they should be set to.
#' @examples
#' \dontrun{
#' input_select("input_a", c("a", "b", "c"))
#' input_slider("input_b", c(0, 10))
#' input_rule("input_a == 'a' && input_b != 0", list(input_b = 10))
#' }
#' @return The entered condition and effects.
#' @export

input_rule <- function(condition, effects) {
  conditions <- substitute(condition)
  if (!is.character(condition)) condition <- deparse(condition)
  r <- list(condition = parse_rule(condition), effects = as.list(effects))
  caller <- parent.frame()
  if (
    !is.null(attr(caller, "name")) &&
      attr(caller, "name") == "community_site_parts"
  ) {
    caller$rules <- c(caller$rules, list(r))
  }
  r
}
