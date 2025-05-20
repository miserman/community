#' Add a navbar (header) section to a website
#'
#' Adds a bar at the top of the page, potentially with a title and logo image.
#'
#' @param ... Content to add to the navbar. Can be lists specifying submenus and their items.
#' Each list can have entries for \code{"name"} (the navbar button text), \code{"title"} (the menu title),
#' \code{"foot"} (the menu footer), \code{"id"} (the ID of the menu element),
#' \code{"class"} (class of the menu element), \code{"placement"} (start, top, end, or bottom),
#' \code{"backdrop"} (logical, where \code{FALSE} disables the backdrop and makes the menu shift
#' main content), and \code{items} (a list of menu items).
#' @param title A title to appear in the header.
#' @param logo URL of an image to appear in the header.
#' @param breakpoint Bootstrap breakpoint code specifying the width at which the menu collapses;
#' default is \code{"md"}.
#' @param logo.height Character or number setting the height of the logo.
#' @param logo.width Character or number setting the width of the logo.
#' @examples
#' page_navbar(
#'   title = "Site Name",
#'   list(
#'     name = "menu",
#'     title = "Menu",
#'     items = list(input_select("menu select", c("a", "b")))
#'   )
#' )
#' @return A character vector of the content to be added.
#' @export

page_navbar <- function(
  ...,
  title = "",
  logo = "",
  breakpoint = "md",
  logo.height = "24px",
  logo.width = "24px"
) {
  caller <- parent.frame()
  building <- !is.null(attr(caller, "name")) &&
    attr(caller, "name") == "community_site_parts"
  parts <- new.env()
  attr(parts, "name") <- "community_site_parts"
  submenus <- substitute(...())
  n <- length(submenus)
  parts$uid <- caller$uid
  r <- c(
    paste0('<nav class="navbar navbar-dark navbar-expand-', breakpoint, '">'),
    '<div class="container-fluid">',
    if (!missing(logo)) {
      paste0(
        '<span class="navbar-brand"><img alt="site logo" height=',
        logo.height,
        " width=",
        logo.width,
        ' src="',
        logo,
        '">'
      )
    },
    if (!missing(title)) paste0("<span>", title, "</span>"),
    if (!missing(logo)) "</span>"
  )
  menus <- NULL
  if (n) {
    r <- c(
      r,
      paste(
        '<button type="button" class="navbar-toggler" data-bs-toggle="collapse"',
        'data-bs-target="#navbar_menu"',
        'aria-controls="narbar_menu" aria-expanded="false" aria-label="toggle navbar menu">'
      ),
      '<span class="navbar-toggler-icon"></span>',
      "</button>",
      '<div class="collapse navbar-collapse" id="navbar_menu">',
      '<ul class="navbar-nav">'
    )
    for (i in seq_len(n)) {
      if (submenus[[i]][[1]] == "list") {
        if (is.null(names(submenus[[i]])))
          submenus[[i]] <- list(items = submenus[[i]])
        id <- if (is.null(submenus[[i]]$id))
          paste0("submenu", parts$uid, i) else submenus[[i]]$id
        if (is.null(submenus[[i]]$name))
          submenus[[i]]$name <- if (!is.null(names(submenus)))
            names(submenus)[i] else "Menu"
        r <- c(
          r,
          paste0(
            '<li class="nav-item">',
            '<button class="btn btn-link" type="button" data-bs-toggle="offcanvas" data-bs-target="#',
            id,
            '" aria-controls="',
            id,
            '">',
            submenus[[i]]$name,
            "</button>",
            "</li>"
          )
        )
        has_foot <- !is.null(submenus[[i]]$foot)
        menus <- c(
          menus,
          paste(
            c(
              '<div tabindex="-1" id="',
              id,
              '" aria-labelledby="',
              id,
              '_label" class="offcanvas offcanvas-',
              if (is.null(submenus[[i]]$placement)) "end" else
                submenus[[i]]$placement,
              if (!is.null(submenus[[i]]$class)) paste("", submenus[[i]]$class),
              if (!is.null(submenus[[i]]$backdrop))
                c('" data-bs-backdrop="', submenus[[i]]$backdrop),
              '">'
            ),
            collapse = ""
          ),
          '<div class="offcanvas-header">',
          paste0(
            '<h5 class="offcanvas-title" id="',
            id,
            '_label">',
            submenus[[i]][
              if (is.null(submenus[[i]]$title)) "name" else "title"
            ],
            "</h5>"
          ),
          '<button class="btn-close text-reset" type="button" data-bs-dismiss="offcanvas" title="Close"></button>',
          "</div>",
          paste0(
            '<div class="offcanvas-body"',
            if (has_foot) ' style="bottom: 46px"',
            ">"
          ),
          unlist(
            lapply(submenus[[i]]$items[-1], eval, parts),
            use.names = FALSE
          ),
          "</div>",
          if (has_foot) {
            c(
              '<div class="offcanvas-footer">',
              unlist(
                lapply(submenus[[i]]$foot[-1], eval, parts),
                use.names = FALSE
              ),
              "</div>"
            )
          },
          "</div>"
        )
      } else {
        r <- c(
          r,
          paste0(
            '<li class="nav-item">',
            paste(eval(submenus[[i]]), collapse = ""),
            "</li>"
          )
        )
      }
    }
  }
  r <- c(r, "</ul></div></div></nav>", menus)
  if (building) {
    caller$header <- r
    for (n in names(parts))
      if (n != "content" && n != "uid")
        caller[[n]] <- c(caller[[n]], parts[[n]])
    caller$uid <- parts$uid + 1
  }
  r
}
