#' Add an internal variable to a website
#'
#' Creates an internal variable (virtual input), which can be used for display logic.
#'
#' @param id Name of the variable, which can be referred to by other inputs of outputs.
#' @param cases A list of conditions with names specifying conditions, and values to set the variable to
#' in that condition (e.g., \code{list("input_a == 1" = 1)}).
#' These can also be specified separately with an \code{\link{input_rule}}.
#' @param default The value to set if no condition is \code{TRUE}.
#' @param display A list mapping cases names to display names (e.g., \code{list(value = "Value")}).
#' @examples
#' \dontrun{
#' input_select("input_a", c("a", "b", "c"))
#' input_variable("vinput_a", list("input_a == c" = "b"), "a")
#'
#' # vinput_a will be "a" unless input_a is "c"
#' }
#' @return A version of the resulting variable object.
#' @export

input_variable <- function(id, cases, default = "", display = list()) {
  r <- Filter(
    length,
    list(
      id = id,
      states = lapply(seq_along(cases), function(i) {
        list(
          condition = parse_rule(names(cases[i])),
          value = cases[[i]]
        )
      }),
      default = default,
      display = display
    )
  )
  caller <- parent.frame()
  if (
    !is.null(attr(caller, "name")) &&
      attr(caller, "name") == "community_site_parts"
  ) {
    caller$variables <- c(caller$variables, list(r))
  }
  r
}
